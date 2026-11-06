package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.IdempotencyKey;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface IdempotencyKeyRepository extends JpaRepository<IdempotencyKey, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<IdempotencyKey> findByKey(String key);
}
