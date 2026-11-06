package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) Optional<RefreshToken> findByTokenHash(String tokenHash);
    @Modifying @Query("update RefreshToken r set r.revoked = true where r.user.id = :userId and r.revoked = false")
    int revokeAll(long userId);

    @Modifying @Query("update RefreshToken r set r.revoked = true where r.device.id = :deviceId and r.revoked = false")
    int revokeByDeviceId(long deviceId);

    long deleteByDevice_IdIn(java.util.Collection<Long> deviceIds);
}
