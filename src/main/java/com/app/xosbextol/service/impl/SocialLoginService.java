package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.dto.SocialLoginRequestDto;
import com.app.xosbextol.model.dto.TokenResponseDto;
import com.app.xosbextol.service.UserAccess;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.util.Crypto;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.util.*;

@Service
public class SocialLoginService {
    private final UserAccess users;
    private final AuthService auth;
    private final StringRedisTemplate redis;
    private final Map<String, JwtDecoder> decoders = new HashMap<>();

    public SocialLoginService(UserAccess users, AuthService auth, StringRedisTemplate redis,
                              @Value("${app.social.google-client-ids}") String google) {
        this.users = users;
        this.auth = auth;
        this.redis = redis;
        configure("GOOGLE", google, "https://www.googleapis.com/oauth2/v3/certs", Set.of("https://accounts.google.com", "accounts.google.com"));
    }

    private void configure(String provider, String audiences, String jwks, Set<String> issuers) {
        if (audiences.isBlank()) return;
        Set<String> allowed = new HashSet<>(Arrays.asList(audiences.split(",")));
        var decoder = NimbusJwtDecoder.withJwkSetUri(jwks).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<Jwt>(JwtValidators.createDefault(), jwt ->
                jwt.getIssuer() != null && issuers.contains(jwt.getIssuer().toString()) && jwt.getAudience().stream().anyMatch(allowed::contains)
                        && jwt.getExpiresAt() != null && jwt.getSubject() != null && !jwt.getSubject().isBlank()
                        ? OAuth2TokenValidatorResult.success() : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"))));
        decoders.put(provider, decoder);
    }

    public Map<String, String> challenge(String provider, Long user, String ip) {
        if (!decoders.containsKey(provider)) throw BusinessException.invalid("Sosial giriş konfiqurasiya edilməyib");
        String rate = "social-rate:" + Crypto.sha256(ip);
        Long count = redis.opsForValue().increment(rate);
        if (count != null && count == 1) redis.expire(rate, Duration.ofMinutes(5));
        if (count != null && count > 30)
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED");
        String token = Crypto.randomToken();
        redis.opsForValue().set("social:" + token, provider + ":" + (user == null ? "login" : user), Duration.ofMinutes(5));
        return Map.of("challenge", token, "nonce", token);
    }

    private Jwt identityToken(SocialLoginRequestDto request, Long user) {
        var decoder = decoders.get(request.provider());
        if (decoder == null) throw BusinessException.invalid("Sosial giriş konfiqurasiya edilməyib");
        String expected = request.provider() + ":" + (user == null ? "login" : user);
        if (!expected.equals(redis.opsForValue().getAndDelete("social:" + request.challenge()))) throw denied();
        Jwt jwt;
        try {
            jwt = decoder.decode(request.idToken());
        } catch (JwtException ex) {
            throw denied();
        }
        if (!Crypto.equal(request.challenge(), jwt.getClaimAsString("nonce"))) throw denied();
        return jwt;
    }

    public TokenResponseDto login(SocialLoginRequestDto request) {
        Jwt jwt = identityToken(request, null);
        boolean emailVerified = verified(jwt.getClaim("email_verified"));
        String firstName = "GOOGLE".equals(request.provider()) ? jwt.getClaimAsString("given_name") : request.firstName();
        String lastName = "GOOGLE".equals(request.provider()) ? jwt.getClaimAsString("family_name") : request.lastName();
        return auth.socialTokens(users.socialIdentity(request.provider(), jwt.getSubject(),
                jwt.getClaimAsString("email"), emailVerified, firstName, lastName),
                request.deviceId(), request.deviceName(), request.platform(), request.osVersion(),
                request.appVersion(), request.fcmToken());
    }

    public void link(long user, SocialLoginRequestDto request) {
        users.linkSocial(user, request.provider(), identityToken(request, user).getSubject());
    }

    private boolean verified(Object value) {
        return Boolean.TRUE.equals(value) || "true".equalsIgnoreCase(String.valueOf(value));
    }

    private BusinessException denied() {
        return new BusinessException(HttpStatus.UNAUTHORIZED, "Sosial giriş tokeni etibarsızdır");
    }
}
