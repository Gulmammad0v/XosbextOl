package com.app.xosbextol.service.impl;

import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.model.entity.IdempotencyKey;
import com.app.xosbextol.repository.IdempotencyKeyRepository;
import com.app.xosbextol.repository.UserRepository;
import com.app.xosbextol.util.Crypto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class IdempotencyService {
    private final IdempotencyKeyRepository keys;
    private final UserRepository users;

    public String scoped(String operation, long user, String key) {
        if (key == null || key.isBlank() || key.length() > 100)
            throw BusinessException.invalid("Idempotency-Key tələb olunur (1–100 simvol)");
        return Crypto.sha256(operation + ":" + user + ":" + key);
    }

    public Optional<Long> previous(String key, String fingerprint) {
        var stored=keys.findByKey(key);
        if(stored.isEmpty()) return Optional.empty();
        if (!fingerprint.equals(stored.get().getRequestHash()))
            throw BusinessException.conflict("Eyni açarla fərqli sorğu göndərilib");
        Object id=stored.get().getResponseBody().get("id");
        return Optional.of(((Number)id).longValue());
    }

    public void remember(String key, long user, String fingerprint, long id) {
        var stored=new IdempotencyKey();stored.setKey(key);stored.setUser(users.getReferenceById(user));
        stored.setRequestHash(fingerprint);stored.setResponseStatus(201);stored.setResponseBody(java.util.Map.of("id",id));
        keys.save(stored);
    }
}
