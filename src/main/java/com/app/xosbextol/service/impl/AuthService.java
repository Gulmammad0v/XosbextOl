package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.value.UserIdentity;

import com.app.xosbextol.model.value.UserCredential;

import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.repository.*;
import com.app.xosbextol.repository.cache.OtpStore;
import com.app.xosbextol.client.email.OtpEmailGateway;
import com.app.xosbextol.util.EmailAddress;
import jakarta.annotation.PostConstruct;
import com.app.xosbextol.util.Crypto;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.handler.customExceptions.DeviceLimitException;
import com.app.xosbextol.service.UserAccess;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;

import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
@Log4j2
public class AuthService {
    private final RefreshTokenRepository refreshTokens;
    private final UserDeviceRepository userDevices;
    private final UserRepository userRepository;
    private final StringRedisTemplate redis;
    private final OtpStore otpStore;
    private final OtpEmailGateway emailGateway;
    private final UserAccess users;
    private final JwtEncoder encoder;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    @Value("${app.otp.ttl-seconds}")
    private long otpTtl;
    @Value("${app.otp.challenge-ttl-seconds:600}")
    private long challengeTtl;
    @Value("${app.otp.max-attempts}")
    private int maxAttempts;
    @Value("${app.otp.max-per-hour}")
    private int maxPerHour;
    @Value("${app.jwt.access-ttl-minutes}")
    private long accessMinutes;
    @Value("${app.jwt.refresh-ttl-days}")
    private long refreshDays;
    @Value("${app.auth.device-retention-days:30}")
    private long deviceRetentionDays;
    @Value("${app.auth.device-limit-token-minutes:5}")
    private long deviceLimitTokenMinutes;
    private String dummyPassword;

    @PostConstruct
    void initializeDummyPassword() {
        dummyPassword = passwordEncoder.encode(Crypto.randomToken());
    }

    private void rateLimit(String scope, String value, int limit) {
        String key = "rate:" + scope + ":" + Crypto.sha256(value) + ":" + clock.instant().getEpochSecond() / 3600;
        Long n = redis.opsForValue().increment(key);
        if (n != null && n == 1) redis.expire(key, Duration.ofHours(2));
        if (n != null && n > limit) throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED");
    }

    @Transactional
    public void sendRegistrationOtp(SendOtpRequestDto req, String ip) {
        String email = EmailAddress.normalize(req.getEmail());
        if (users.exists(email)) throw BusinessException.conflict("Bu email ilə hesab artıq mövcuddur");
        sendRegistrationOtp(email, ip);
    }

    @Transactional
    public void sendPasswordResetOtp(SendOtpRequestDto req, String ip) {
        String email = EmailAddress.normalize(req.getEmail());
        rateLimit("otp-ip", ip, 30);
        rateLimit("otp-email", email, maxPerHour);
        var userId = users.passwordResetUserId(email);
        if (userId.isEmpty()) return;
        createAndSendPasswordResetOtp(userId.getAsLong(), email);
    }

    private void sendRegistrationOtp(String email, String ip) {
        rateLimit("otp-ip", ip, 30);
        rateLimit("otp-email", email, maxPerHour);
        String code = Crypto.otp();
        otpStore.saveRegistrationCode(email, code, Duration.ofSeconds(otpTtl));
        emailGateway.sendCode(email, code, otpTtl);
    }

    private void createAndSendPasswordResetOtp(long userId, String email) {
        String code = Crypto.otp();
        otpStore.savePasswordResetCode(userId, email, code, Duration.ofSeconds(otpTtl));
        emailGateway.sendCode(email, code, otpTtl);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public OtpChallengeResponseDto verifyRegistrationOtp(VerifyOtpRequestDto req, String ip) {
        String email = EmailAddress.normalize(req.getEmail());
        if (users.exists(email)) throw BusinessException.conflict("Bu email ilə hesab artıq mövcuddur");
        return verifyOtp(email, req.getCode(), OtpPurpose.REGISTER, ip);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public OtpChallengeResponseDto verifyPasswordResetOtp(VerifyOtpRequestDto req, String ip) {
        String email = EmailAddress.normalize(req.getEmail());
        if (users.passwordResetUserId(email).isEmpty()) throw unauthorized();
        return verifyOtp(email, req.getCode(), OtpPurpose.PASSWORD_RESET, ip);
    }

    private OtpChallengeResponseDto verifyOtp(String email, String code, OtpPurpose purpose, String ip) {
        rateLimit("verify-ip", ip, 100);
        String token = Crypto.randomToken();
        if (!otpStore.verifyCode(email, purpose, code, maxAttempts, token, Duration.ofSeconds(challengeTtl)))
            throw unauthorized();
        return new OtpChallengeResponseDto(token, challengeTtl);
    }

    @Transactional
    public TokenResponseDto completeRegistration(CompleteRegistrationRequestDto req) {
        if (!req.getPassword().equals(req.getConfirmPassword())) throw BusinessException.invalid("Parollar eyni deyil");
        String email = consumeChallenge(req.getToken(), OtpPurpose.REGISTER);
        var user = users.register(email, passwordEncoder.encode(req.getPassword()), req.getFirstName(), req.getLastName(),
                req.getBirthDate(), req.getPhone(), req.getRole().name());
        return openDeviceSession(user, deviceRequest(req.getDeviceId(), req.getDeviceName(), req.getPlatform(),
                req.getOsVersion(), req.getAppVersion(), req.getFcmToken()));
    }

    @Transactional
    public TokenResponseDto login(LoginRequestDto req, String ip) {
        var credential = authenticate(req.getEmail(), req.getPassword(), ip);
        if (Role.ADMIN.name().equals(credential.identity().role())) throw BusinessException.forbidden();
        return openDeviceSession(credential.identity(), deviceRequest(req.getDeviceId(), req.getDeviceName(),
                req.getPlatform(), req.getOsVersion(), req.getAppVersion(), req.getFcmToken()));
    }

    @Transactional(readOnly = true)
    public TokenResponseDto adminLogin(AdminLoginRequestDto req, String ip) {
        var credential = authenticate(req.getEmail(), req.getPassword(), ip);
        if (!Role.ADMIN.name().equals(credential.identity().role())) throw invalidCredentials();
        return issueAccessOnly(credential.identity());
    }

    private UserCredential authenticate(String requestedEmail, String password, String ip) {
        String email = EmailAddress.normalize(requestedEmail);
        rateLimit("login-ip", ip, 100);
        rateLimit("login-email", email, 20);
        var credential = users.credentials(email);
        String stored = credential.map(UserCredential::passwordHash).orElse(null);
        boolean matches = passwordEncoder.matches(password, stored == null ? dummyPassword : stored);
        if (credential.isPresent() && stored == null) throw googleAccountWithoutPassword();
        if (credential.isEmpty() || !matches) throw invalidCredentials();
        return credential.get();
    }

    @Transactional
    public void resetPassword(ResetPasswordRequestDto req) {
        if (!req.getNewPassword().equals(req.getConfirmPassword()))
            throw BusinessException.invalid("Parollar eyni deyil");
        String email = consumeChallenge(req.getToken(), OtpPurpose.PASSWORD_RESET);
        var user = users.changePassword(email, passwordEncoder.encode(req.getNewPassword()));
        refreshTokens.revokeAll(user.id());
    }

    @Transactional
    public void changePassword(long userId, ChangePasswordRequestDto req) {
        if (!req.getNewPassword().equals(req.getConfirmPassword()))
            throw BusinessException.invalid("Yeni parollar eyni deyil");
        var user = users.requireActive(userId);
        String stored = users.credentials(user.email())
                .map(UserCredential::passwordHash)
                .orElse(null);
        if (stored == null) {
            users.changePassword(user.email(), passwordEncoder.encode(req.getNewPassword()));
            return;
        }
        if (Objects.equals(req.getCurrentPassword(), req.getNewPassword()))
            throw BusinessException.invalid("Yeni parol köhnə paroldan fərqli olmalıdır");
        if (req.getCurrentPassword() == null || !passwordEncoder.matches(req.getCurrentPassword(), stored))
            throw BusinessException.invalid("Köhnə parol yanlışdır");

        users.changePassword(user.email(), passwordEncoder.encode(req.getNewPassword()));
    }

    private String consumeChallenge(String token, OtpPurpose purpose) {
        return otpStore.consumeChallenge(token, purpose).orElseThrow(this::unauthorized);
    }

    @Transactional
    public TokenResponseDto refresh(RefreshTokenRequestDto req) {
        RefreshToken token = refreshTokens.findByTokenHash(Crypto.sha256(req.getRefreshToken()))
                .orElseThrow(this::unauthorized);
        UserDevice device = token.getDevice();
        if (token.getRevoked() || !token.getExpiresAt().isAfter(clock.instant())
                || device.getStatus() != DeviceStatus.ACTIVE
                || !Objects.equals(device.getDeviceId(), req.getDeviceId()))
            throw unauthorized();
        token.setRevoked(true);
        device.setLastActiveAt(clock.instant());
        return issue(users.requireActive(token.getUser().getId()), device);
    }

    @Transactional
    public void logout(RefreshTokenRequestDto req) {
        refreshTokens.findByTokenHash(Crypto.sha256(req.getRefreshToken())).ifPresent(token -> {
            if (Objects.equals(token.getDevice().getDeviceId(), req.getDeviceId())) {
                token.setRevoked(true);
                revokeDevice(token.getDevice());
            }
        });
    }

    @Transactional(readOnly = true)
    public UserDeviceListResponseDto devices(long userId, Long currentDeviceId) {
        var identity = users.requireActive(userId);
        int limit = deviceLimit(identity.role());
        var values = activeDevices(userId).stream().map(device -> response(device,
                currentDeviceId != null && Objects.equals(currentDeviceId, device.getId()))).toList();
        return new UserDeviceListResponseDto(values, values.size(), limit);
    }

    @Transactional
    public void revokeDevice(long userId, long id, Long currentDeviceId) {
        if (currentDeviceId != null && currentDeviceId == id)
            throw BusinessException.invalid("Cari cihazı bu siyahıdan çıxarmaq olmaz");
        UserDevice device = userDevices.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> BusinessException.missing("Cihaz"));
        revokeDevice(device);
    }

    @Transactional
    public void revokeOtherDevices(long userId, Long currentDeviceId) {
        if (currentDeviceId == null) throw BusinessException.invalid("Cari cihaz müəyyən edilmədi");
        for (UserDevice device : activeDevices(userId)) {
            if (!Objects.equals(device.getId(), currentDeviceId)) revokeDevice(device);
        }
    }

    @Transactional
    public TokenResponseDto replaceDevice(long revokedDeviceId, DeviceReplacementRequestDto request) {
        PendingDevice pending = consumeLimitToken(request.limitToken());
        userRepository.lock(pending.userId()).orElseThrow(this::unauthorized);
        UserDevice oldDevice = userDevices.findByIdAndUser_Id(revokedDeviceId, pending.userId())
                .filter(device -> device.getStatus() == DeviceStatus.ACTIVE)
                .orElseThrow(() -> BusinessException.missing("Cihaz"));
        revokeDevice(oldDevice);
        var user = users.requireActive(pending.userId());
        return activateAndIssue(user, pending.request());
    }

    @Transactional
    public void cleanupStaleDevices() {
        Instant cutoff = activeCutoff();
        List<UserDevice> stale = userDevices.findByLastActiveAtBefore(cutoff);
        if (stale.isEmpty()) return;
        List<Long> ids = stale.stream().map(UserDevice::getId).toList();
        refreshTokens.deleteByDevice_IdIn(ids);
        userDevices.deleteAllInBatch(stale);
        log.info("Stale user devices deleted count={}", stale.size());
    }

    private TokenResponseDto openDeviceSession(UserIdentity user, DeviceRequest request) {
        userRepository.lock(user.id()).orElseThrow(this::unauthorized);
        return activateAndIssue(user, request);
    }

    private TokenResponseDto activateAndIssue(UserIdentity user, DeviceRequest request) {
        UserDevice device = userDevices.findByUser_IdAndDeviceId(user.id(), request.deviceId()).orElse(null);
        boolean alreadyActive = device != null && device.getStatus() == DeviceStatus.ACTIVE
                && device.getLastActiveAt().isAfter(activeCutoff());
        if (!alreadyActive && userDevices.countByUser_IdAndStatusAndLastActiveAtAfter(
                user.id(), DeviceStatus.ACTIVE, activeCutoff()) >= deviceLimit(user.role())) {
            throw deviceLimit(user, request);
        }
        if (device == null) {
            device = new UserDevice();
            device.setUser(userRepository.getReferenceById(user.id()));
            device.setDeviceId(request.deviceId());
        }
        updateDevice(device, request);
        device = userDevices.save(device);
        if (request.fcmToken() != null) userDevices.clearFcmTokenFromOtherDevices(request.fcmToken(), device.getId());
        refreshTokens.revokeByDeviceId(device.getId());
        return issue(user, device);
    }

    private TokenResponseDto issue(UserIdentity user, UserDevice device) {
        Instant now = clock.instant();
        String refresh = Crypto.randomToken();
        RefreshToken token = new RefreshToken();
        token.setUser(userRepository.getReferenceById(user.id()));
        token.setTokenHash(Crypto.sha256(refresh));
        token.setDevice(device);
        token.setExpiresAt(now.plus(Duration.ofDays(refreshDays)));
        refreshTokens.save(token);
        var claims = JwtClaimsSet.builder().issuer("xosbextOl").subject(Long.toString(user.id()))
                .issuedAt(now).expiresAt(now.plus(Duration.ofMinutes(accessMinutes))).claim("role", user.role())
                .claim("device_id", device.getId()).build();
        String access = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new TokenResponseDto(access, refresh, accessMinutes * 60, "Bearer");
    }

    private TokenResponseDto issueAccessOnly(UserIdentity user) {
        Instant now = clock.instant();
        var claims = JwtClaimsSet.builder().issuer("xosbextOl").subject(Long.toString(user.id()))
                .issuedAt(now).expiresAt(now.plus(Duration.ofMinutes(accessMinutes))).claim("role", user.role()).build();
        String access = encoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new TokenResponseDto(access, null, accessMinutes * 60, "Bearer");
    }

    @Transactional
    public TokenResponseDto socialTokens(UserIdentity user, String deviceId,
                                         String deviceName, String platform, String osVersion,
                                         String appVersion, String fcmToken) {
        return openDeviceSession(user, deviceRequest(deviceId, deviceName, platform, osVersion, appVersion, fcmToken));
    }

    private DeviceLimitException deviceLimit(UserIdentity user, DeviceRequest request) {
        String rawToken = Crypto.randomToken();
        String value = String.join("|", Long.toString(user.id()), encode(request.deviceId()), encode(request.deviceName()),
                encode(request.platform()), encode(request.osVersion()), encode(request.appVersion()), encode(request.fcmToken()));
        redis.opsForValue().set(limitKey(rawToken), value, Duration.ofMinutes(deviceLimitTokenMinutes));
        return new DeviceLimitException(rawToken, deviceLimit(user.role()), activeDevices(user.id()).stream()
                .map(device -> response(device, false)).toList());
    }

    private PendingDevice consumeLimitToken(String rawToken) {
        String value = redis.opsForValue().getAndDelete(limitKey(rawToken));
        if (value == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_TOKEN");
        String[] parts = value.split("\\|", -1);
        if (parts.length != 7) throw unauthorized();
        try {
            return new PendingDevice(Long.parseLong(parts[0]), deviceRequest(decode(parts[1]), decode(parts[2]),
                    decode(parts[3]), decode(parts[4]), decode(parts[5]), decode(parts[6])));
        } catch (RuntimeException ex) {
            throw unauthorized();
        }
    }

    private String limitKey(String token) { return "device-limit:" + Crypto.sha256(token); }
    private String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(Objects.toString(value, "").getBytes(StandardCharsets.UTF_8));
    }
    private String decode(String value) {
        String decoded = new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
        return decoded.isEmpty() ? null : decoded;
    }

    private List<UserDevice> activeDevices(long userId) {
        return userDevices.findByUser_IdAndStatusAndLastActiveAtAfterOrderByLastActiveAtDesc(
                userId, DeviceStatus.ACTIVE, activeCutoff());
    }

    private Instant activeCutoff() { return clock.instant().minus(Duration.ofDays(deviceRetentionDays)); }
    private int deviceLimit(String role) { return Role.CUSTOMER.name().equals(role) ? 3 : 2; }

    private UserDeviceResponseDto response(UserDevice device, boolean current) {
        return new UserDeviceResponseDto(device.getId(), device.getDeviceName(), device.getPlatform(),
                device.getOsVersion(), device.getAppVersion(), device.getLastActiveAt(), device.getLastCity(),
                device.getStatus().name(), device.getFcmToken() != null, current);
    }

    private void updateDevice(UserDevice device, DeviceRequest request) {
        device.setDeviceName(request.deviceName());
        device.setPlatform(request.platform());
        device.setOsVersion(request.osVersion());
        device.setAppVersion(request.appVersion());
        if (request.fcmToken() != null) device.setFcmToken(request.fcmToken());
        device.setLastActiveAt(clock.instant());
        device.setStatus(DeviceStatus.ACTIVE);
    }

    private void revokeDevice(UserDevice device) {
        device.setStatus(DeviceStatus.REVOKED);
        device.setFcmToken(null);
        refreshTokens.revokeByDeviceId(device.getId());
    }

    private DeviceRequest deviceRequest(String id, String name, String platform, String os, String app, String fcm) {
        if (id == null || id.isBlank() || name == null || name.isBlank() || platform == null)
            throw BusinessException.invalid("Cihaz məlumatları natamamdır");
        return new DeviceRequest(id, name, platform, os, app, fcm);
    }

    @lombok.Value
    @lombok.Builder
    @lombok.extern.jackson.Jacksonized
    @lombok.experimental.Accessors(fluent = true)
    private static class DeviceRequest {
        String deviceId;
        String deviceName;
        String platform;
        String osVersion;
        String appVersion;
        String fcmToken;
    }
    @lombok.Value
    @lombok.Builder
    @lombok.extern.jackson.Jacksonized
    @lombok.experimental.Accessors(fluent = true)
    private static class PendingDevice {
        long userId;
        DeviceRequest request;
    }

    private BusinessException unauthorized() {
        return new BusinessException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_TOKEN");
    }

    private BusinessException invalidCredentials() {
        return new BusinessException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS");
    }

    private BusinessException googleAccountWithoutPassword() {
        return new BusinessException(HttpStatus.UNAUTHORIZED, "AUTH_PASSWORD_LOGIN_UNAVAILABLE");
    }
}
