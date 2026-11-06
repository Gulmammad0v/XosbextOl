package com.app.xosbextol.auth;
import com.app.xosbextol.support.PostgresIntegrationSupport;
import com.app.xosbextol.service.impl.AuthService;
import com.app.xosbextol.model.enums.OtpPurpose;
import com.app.xosbextol.model.enums.Role;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.repository.cache.OtpStore;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.handler.customExceptions.DeviceLimitException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.time.Duration;
import java.time.LocalDate;
import java.sql.Timestamp;
import java.util.concurrent.ThreadLocalRandom;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@AutoConfigureMockMvc
class AuthSecurityIT extends PostgresIntegrationSupport {
    @Autowired AuthService auth;
    @Autowired OtpStore otpStore;
    @Autowired StringRedisTemplate redis;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    private String email;
    @BeforeEach void seed() {
        email="customer-"+String.format("%07d",ThreadLocalRandom.current().nextInt(10_000_000))+"@example.com";
        otpStore.saveRegistrationCode(email, "123456", Duration.ofSeconds(120));
    }
    private TokenResponseDto tokens() {
        var challenge=auth.verifyRegistrationOtp(new VerifyOtpRequestDto(email,"123456"),"auth-test");
        return auth.completeRegistration(new CompleteRegistrationRequestDto(challenge.getToken(),"Test","User",LocalDate.of(1990,1,1),"Secure123!","Secure123!","test"));
    }
    private LoginRequestDto loginRequest(String deviceId, String deviceName) {
        var request = new LoginRequestDto();
        request.setEmail(email);
        request.setPassword("Secure123!");
        request.setDeviceId(deviceId);
        request.setDeviceName(deviceName);
        request.setPlatform("ANDROID");
        request.setOsVersion("16");
        request.setAppVersion("1.0.0");
        request.setFcmToken("fcm-" + deviceId);
        return request;
    }
    @Test void failedAttemptsPersistAndOtpCannotBeReused() {
        for(int i=0;i<5;i++) assertThrows(BusinessException.class,()->auth.verifyRegistrationOtp(new VerifyOtpRequestDto(email,"000000"),"auth-test"));
        assertThrows(BusinessException.class,this::tokens);
        assertEquals("5",redis.opsForValue().get(otpStore.attemptsKey(email, OtpPurpose.REGISTER)));
    }
    @Test void refreshRotatesAndLogoutRevokes() {
        var challenge=auth.verifyRegistrationOtp(new VerifyOtpRequestDto(email,"123456"),"auth-test");
        var first=auth.completeRegistration(new CompleteRegistrationRequestDto(challenge.getToken(),"Test","User",
                LocalDate.of(1990,1,1),Role.CUSTOMER,null,"Secure123!","Secure123!","test","device-1234567890"));
        String storedHash=jdbc.queryForObject("select r.token_hash from refresh_tokens r join user_devices d on d.id=r.device_id where d.device_id=? and r.revoked=false",
                String.class,"device-1234567890");
        assertEquals(com.app.xosbextol.util.Crypto.sha256(first.getRefreshToken()),storedHash);
        assertNotEquals(first.getRefreshToken(),storedHash);
        assertThrows(BusinessException.class,()->auth.refresh(new RefreshTokenRequestDto(first.getRefreshToken(),"other-device-1234")));
        var next=auth.refresh(new RefreshTokenRequestDto(first.getRefreshToken(),"device-1234567890"));
        assertThrows(BusinessException.class,()->auth.refresh(new RefreshTokenRequestDto(first.getRefreshToken(),"device-1234567890")));
        auth.logout(new RefreshTokenRequestDto(next.getRefreshToken(),"device-1234567890"));
        assertThrows(BusinessException.class,()->auth.refresh(new RefreshTokenRequestDto(next.getRefreshToken(),"device-1234567890")));
    }
    @Test void repeatedLoginUpdatesOneDeviceAndLimitReplacementIsAtomic() {
        tokens();
        long userId = jdbc.queryForObject("select id from users where email=?", Long.class, email);

        auth.login(loginRequest("00000000-0000-4000-8000-000000000001", "Pixel 9"), "same-device-test");
        assertEquals(1, jdbc.queryForObject("select count(*) from user_devices where user_id=?", Integer.class, userId));
        assertEquals("Pixel 9", jdbc.queryForObject("select device_name from user_devices where user_id=?", String.class, userId));
        assertEquals(1, jdbc.queryForObject("select count(*) from refresh_tokens where user_id=? and revoked=false", Integer.class, userId));

        auth.login(loginRequest("00000000-0000-4000-8000-000000000002", "Galaxy S25"), "limit-test");
        auth.login(loginRequest("00000000-0000-4000-8000-000000000003", "iPad Air"), "limit-test");
        var limit = assertThrows(DeviceLimitException.class,
                () -> auth.login(loginRequest("00000000-0000-4000-8000-000000000004", "Pixel Tablet"), "limit-test"));
        assertEquals(3, limit.deviceLimit());
        assertEquals(3, limit.devices().size());

        long removedId = limit.devices().getFirst().id();
        var replacement = auth.replaceDevice(removedId, new DeviceReplacementRequestDto(limit.limitToken()));
        assertNotNull(replacement.getAccessToken());
        assertEquals(3, jdbc.queryForObject("select count(*) from user_devices where user_id=? and status='ACTIVE'", Integer.class, userId));
        assertEquals(1, jdbc.queryForObject("select count(*) from user_devices where user_id=? and device_id=? and status='ACTIVE'", Integer.class,
                userId, "00000000-0000-4000-8000-000000000004"));
        assertThrows(BusinessException.class,
                () -> auth.replaceDevice(removedId, new DeviceReplacementRequestDto(limit.limitToken())));
    }
    @Test void realJwtEnforcesRoleAndBlockedUsers() throws Exception {
        var token=tokens();
        mvc.perform(get("/api/users/me").header("Authorization","Bearer "+token.getAccessToken())).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));
        mvc.perform(get("/api/admin/dashboard").header("Authorization","Bearer "+token.getAccessToken())).andExpect(status().isForbidden());
        mvc.perform(get("/api/partner/venues").header("Authorization","Bearer "+token.getAccessToken())).andExpect(status().isForbidden());
        jdbc.update("update users set status_id=2 where email=?",email);
        mvc.perform(get("/api/users/me").header("Authorization","Bearer "+token.getAccessToken())).andExpect(status().isUnauthorized());
    }
    @Test void publicCatalogAndProtectedBookingRoutes() throws Exception {
        mvc.perform(get("/api/catalog/cities")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(80))
                .andExpect(jsonPath("$[8]").value("Bakı"))
                .andExpect(jsonPath("$[79]").value("Zərdab"));
        mvc.perform(get("/api/bookings")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/payments/webhook").contentType("application/json").header("X-Timestamp",Instant.now().getEpochSecond()).header("X-Signature","bad").content("{}")).andExpect(status().isUnauthorized());
    }
    @Test void venueOwnerCannotUseCustomerBookingOrReviewRoutes() throws Exception {
        String ownerEmail="owner-"+String.format("%07d",ThreadLocalRandom.current().nextInt(10_000_000))+"@example.com";
        otpStore.saveRegistrationCode(ownerEmail, "112233", Duration.ofSeconds(120));
        var challenge=auth.verifyRegistrationOtp(new VerifyOtpRequestDto(ownerEmail,"112233"),"owner-security-test");
        String phone="+99455"+String.format("%07d",ThreadLocalRandom.current().nextInt(10_000_000));
        var owner=auth.completeRegistration(new CompleteRegistrationRequestDto(challenge.getToken(),"Venue","Owner",
                LocalDate.of(1990,1,1),Role.VENUE_OWNER,phone,"Secure123!","Secure123!","owner-security-test"));
        String bearer="Bearer "+owner.getAccessToken();
        mvc.perform(get("/api/bookings").header("Authorization",bearer)).andExpect(status().isForbidden());
        mvc.perform(post("/api/bookings").header("Authorization",bearer).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/reviews").header("Authorization",bearer).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }
    @Test void emailOtpRateLimitIsEnforced() {
        for(int i=0;i<5;i++) auth.sendRegistrationOtp(new SendOtpRequestDto(email),"rate-test");
        var ex=assertThrows(BusinessException.class,()->auth.sendRegistrationOtp(new SendOtpRequestDto(email),"rate-test"));
        assertEquals(429,ex.status().value());
    }
    @Test void otpIsDeliveredBySmtpAndAccountIsCreatedOnlyAfterConfirmation() throws Exception {
        String supplied="  "+email.toUpperCase(java.util.Locale.ROOT)+"  ";
        auth.sendRegistrationOtp(new SendOtpRequestDto(supplied),"smtp-test");
        assertEquals(0,jdbc.queryForObject("select count(*) from users where email=?",Integer.class,email));
        String base="http://"+MAILPIT.getHost()+":"+MAILPIT.getMappedPort(8025);
        String query=java.net.URLEncoder.encode("to:"+email,java.nio.charset.StandardCharsets.UTF_8);
        var response=org.springframework.web.client.RestClient.create(base).get().uri(java.net.URI.create(base+"/api/v1/search?query="+query)).retrieve().body(String.class);
        var json=new tools.jackson.databind.ObjectMapper().readTree(response);
        assertEquals(1,json.get("messages").size());
        var message=json.get("messages").get(0);
        assertEquals(email,message.get("To").get(0).get("Address").asText());
        var match=java.util.regex.Pattern.compile("[0-9]{6}").matcher(message.get("Snippet").asText());
        assertTrue(match.find());String code=match.group();
        String otpKey=otpStore.codeKey(email, OtpPurpose.REGISTER);
        assertTrue(otpKey.startsWith("OTP_REGISTER:"));
        var otpJson=new tools.jackson.databind.ObjectMapper().readTree(redis.opsForValue().get(otpKey));
        assertNull(otpJson.get("userId"));
        assertEquals(email,otpJson.get("email").asText());
        assertEquals(code,otpJson.get("otp").asText());
        assertTrue(redis.getExpire(otpKey)>0 && redis.getExpire(otpKey)<=120);
        assertEquals(0,jdbc.queryForObject("select count(*) from information_schema.tables where table_schema='public' and table_name='otp_codes'",Integer.class));
        var challenge=auth.verifyRegistrationOtp(new VerifyOtpRequestDto(supplied,code),"smtp-test");
        assertEquals(0,jdbc.queryForObject("select count(*) from users where email=?",Integer.class,email));
        var token=auth.completeRegistration(new CompleteRegistrationRequestDto(challenge.getToken(),"Aysel","Məmmədova",LocalDate.of(1995,5,10),"Secure123!","Secure123!","smtp-test"));
        assertNotNull(token.getAccessToken());
        assertNotNull(jdbc.queryForObject("select email_verified_at from users where email=?",Timestamp.class,email));
        assertThrows(BusinessException.class,()->auth.verifyRegistrationOtp(new VerifyOtpRequestDto(email,code),"smtp-test"));
    }
    @Test void caseVariationsShareOneAccountAndCanLogin() {
        var first=tokens();
        var second=auth.login(new LoginRequestDto(email.toUpperCase(java.util.Locale.ROOT),"Secure123!","case-test"),"case-test");
        assertEquals(1,jdbc.queryForObject("select count(*) from users where email=?",Integer.class,email));
        assertNotNull(first.getAccessToken());
        assertNotNull(second.getAccessToken());
    }
    @Test void googleOnlyAccountExplainsHowToSignIn() {
        tokens();
        jdbc.update("update users set password_hash=null, google_id=? where email=?","google-subject-"+email,email);
        var ex=assertThrows(BusinessException.class,
                ()->auth.login(new LoginRequestDto(email,"Secure123!","google-only-test"),"google-only-test"));
        assertEquals(401,ex.status().value());
        assertEquals("AUTH_PASSWORD_LOGIN_UNAVAILABLE", ex.code());
    }
    @Test void invalidEmailAndUnverifiedProfileChangeAreRejected() throws Exception {
        mvc.perform(post("/api/auth/register/otp/send").contentType("application/json").content("{\"email\":\"invalid\"}"))
            .andExpect(status().isBadRequest());
        var token=tokens();
        mvc.perform(put("/api/users/me").header("Authorization","Bearer "+token.getAccessToken()).contentType("application/json")
            .content("{\"fullName\":\"Test\",\"language\":\"az\",\"email\":\"unverified@example.com\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email)).andExpect(jsonPath("$.phone").doesNotExist());
        assertEquals(email,jdbc.queryForObject("select email from users where email=?",String.class,email));
    }
    @Test void passwordResetRevokesSessionsAndChangesPassword() {
        var session=tokens();
        long userId=jdbc.queryForObject("select id from users where email=?",Long.class,email);
        otpStore.savePasswordResetCode(userId, email, "654321", Duration.ofSeconds(120));
        assertTrue(otpStore.codeKey(email, OtpPurpose.PASSWORD_RESET).startsWith("OTP_RESET:"));
        var resetJson=new tools.jackson.databind.ObjectMapper().readTree(redis.opsForValue().get(otpStore.codeKey(email, OtpPurpose.PASSWORD_RESET)));
        assertEquals(userId,resetJson.get("userId").asLong());
        assertEquals(email,resetJson.get("email").asText());
        assertEquals("654321",resetJson.get("otp").asText());
        var challenge=auth.verifyPasswordResetOtp(new VerifyOtpRequestDto(email,"654321"),"reset-test");
        auth.resetPassword(new ResetPasswordRequestDto(challenge.getToken(),"NewSecure123!","NewSecure123!"));
        assertThrows(BusinessException.class,()->auth.refresh(new RefreshTokenRequestDto(session.getRefreshToken())));
        assertThrows(BusinessException.class,()->auth.login(new LoginRequestDto(email,"Secure123!","test"),"reset-test"));
        assertNotNull(auth.login(new LoginRequestDto(email,"NewSecure123!","test"),"reset-test").getAccessToken());
        assertThrows(BusinessException.class,()->auth.resetPassword(new ResetPasswordRequestDto(challenge.getToken(),"Another123!","Another123!")));
    }

    @Test void authenticatedUserCanChangePasswordWithCurrentPassword() throws Exception {
        var session=tokens();
        String bearer="Bearer "+session.getAccessToken();

        mvc.perform(put("/api/users/me/password").header("Authorization",bearer).contentType("application/json")
                        .content("{\"newPassword\":\"NewSecure123!\",\"confirmPassword\":\"NewSecure123!\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/users/me/password").header("Authorization",bearer).contentType("application/json")
                        .content("{\"currentPassword\":\"Wrong123!\",\"newPassword\":\"NewSecure123!\",\"confirmPassword\":\"NewSecure123!\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/users/me/password").header("Authorization",bearer).contentType("application/json")
                        .content("{\"currentPassword\":\"Secure123!\",\"newPassword\":\"NewSecure123!\",\"confirmPassword\":\"Different123!\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/users/me/password").header("Authorization",bearer).contentType("application/json")
                        .content("{\"currentPassword\":\"Secure123!\",\"newPassword\":\"NewSecure123!\",\"confirmPassword\":\"NewSecure123!\"}"))
                .andExpect(status().isOk());

        assertThrows(BusinessException.class,
                ()->auth.login(new LoginRequestDto(email,"Secure123!","change-password-test"),"change-password-test"));
        assertNotNull(auth.login(new LoginRequestDto(email,"NewSecure123!","change-password-test"),"change-password-test").getAccessToken());
    }

    @Test void googleOnlyUserCanSetPasswordWithoutCurrentPassword() throws Exception {
        var session=tokens();
        jdbc.update("update users set password_hash=null, google_id=? where email=?","google-subject-"+email,email);
        String bearer="Bearer "+session.getAccessToken();

        mvc.perform(get("/api/users/me").header("Authorization",bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasPassword").value(false));
        mvc.perform(put("/api/users/me/password").header("Authorization",bearer).contentType("application/json")
                        .content("{\"newPassword\":\"NewSecure123!\",\"confirmPassword\":\"NewSecure123!\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/users/me").header("Authorization",bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasPassword").value(true));

        assertNotNull(auth.login(new LoginRequestDto(email,"NewSecure123!","google-password-test"),
                "google-password-test").getAccessToken());
    }
}
