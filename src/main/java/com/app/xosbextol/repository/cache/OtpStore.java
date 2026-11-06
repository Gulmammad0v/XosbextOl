package com.app.xosbextol.repository.cache;

import com.app.xosbextol.model.enums.OtpPurpose;
import com.app.xosbextol.model.dto.PasswordResetOtpCacheDto;
import com.app.xosbextol.model.dto.RegistrationOtpCacheDto;
import com.app.xosbextol.util.Crypto;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class OtpStore {
    private static final String REGISTER_PREFIX = "OTP_REGISTER:";
    private static final String RESET_PREFIX = "OTP_RESET:";
    private static final String ATTEMPTS_PREFIX = "OTP_ATTEMPTS:";
    private static final String CHALLENGE_PREFIX = "OTP_CHALLENGE:";

    private static final DefaultRedisScript<Long> SAVE_CODE = new DefaultRedisScript<>("""
            redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
            redis.call('DEL', KEYS[2])
            return 1
            """, Long.class);

    private static final DefaultRedisScript<Long> VERIFY_CODE = new DefaultRedisScript<>("""
            local storedValue = redis.call('GET', KEYS[1])
            if not storedValue then
                return -1
            end
            
            local decoded, payload = pcall(cjson.decode, storedValue)
            if not decoded or not payload.otp or not payload.email then
                return -1
            end
            
            local attempts = tonumber(redis.call('GET', KEYS[2]) or '0')
            if attempts >= tonumber(ARGV[2]) then
                return -1
            end
            
            local currentAttempts = redis.call('INCR', KEYS[2])
            if currentAttempts == 1 then
                local codeTtl = redis.call('PTTL', KEYS[1])
                if codeTtl > 0 then
                    redis.call('PEXPIRE', KEYS[2], codeTtl)
                end
            end
            
            if tostring(payload.otp) ~= ARGV[1] then
                return 0
            end
            
            redis.call('DEL', KEYS[1], KEYS[2])
            redis.call('SET', KEYS[3], payload.email, 'EX', ARGV[3])
            return 1
            """, Long.class);

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    public void saveRegistrationCode(String email, String code, Duration ttl) {
        saveCode(email, OtpPurpose.REGISTER, new RegistrationOtpCacheDto(email, code), ttl);
    }

    public void savePasswordResetCode(long userId, String email, String code, Duration ttl) {
        saveCode(email, OtpPurpose.PASSWORD_RESET, new PasswordResetOtpCacheDto(userId, email, code), ttl);
    }

    private void saveCode(String email, OtpPurpose purpose, Object payload, Duration ttl) {
        String json = mapper.writeValueAsString(payload);
        redis.execute(SAVE_CODE, List.of(codeKey(email, purpose), attemptsKey(email, purpose)), json,
                Long.toString(ttl.toSeconds()));
    }

    public boolean verifyCode(String email, OtpPurpose purpose, String code, int maxAttempts,
                              String challengeToken, Duration challengeTtl) {
        Long result = redis.execute(VERIFY_CODE,
                List.of(codeKey(email, purpose), attemptsKey(email, purpose), challengeKey(challengeToken, purpose)),
                code,
                Integer.toString(maxAttempts),
                Long.toString(challengeTtl.toSeconds()));
        return Long.valueOf(1).equals(result);
    }

    public Optional<String> consumeChallenge(String token, OtpPurpose purpose) {
        return Optional.ofNullable(redis.opsForValue().getAndDelete(challengeKey(token, purpose)));
    }

    public String codeKey(String email, OtpPurpose purpose) {
        return purpose == OtpPurpose.REGISTER ? REGISTER_PREFIX + Crypto.sha256(email)
                : RESET_PREFIX + Crypto.sha256(email);
    }

    public String attemptsKey(String email, OtpPurpose purpose) {
        return ATTEMPTS_PREFIX + purpose.name() + ":" + Crypto.sha256(email);
    }

    private String challengeKey(String token, OtpPurpose purpose) {
        return CHALLENGE_PREFIX + purpose.name() + ":" + Crypto.sha256(token);
    }
}
