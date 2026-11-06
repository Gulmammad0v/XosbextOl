package com.app.xosbextol.repository;

import com.app.xosbextol.model.enums.DeviceStatus;
import com.app.xosbextol.model.entity.UserDevice;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserDeviceRepository extends JpaRepository<UserDevice, Long> {
    Optional<UserDevice> findByUser_IdAndDeviceId(long userId, String deviceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<UserDevice> findByIdAndUser_Id(long id, long userId);

    List<UserDevice> findByUser_IdAndStatusAndLastActiveAtAfterOrderByLastActiveAtDesc(
            long userId, DeviceStatus status, Instant cutoff);

    long countByUser_IdAndStatusAndLastActiveAtAfter(long userId, DeviceStatus status, Instant cutoff);

    List<UserDevice> findByLastActiveAtBefore(Instant cutoff);

    List<UserDevice> findByUser_IdAndStatusAndFcmTokenIsNotNull(long userId, DeviceStatus status);

    @Modifying
    @Query("update UserDevice d set d.fcmToken = null where d.fcmToken = :token and d.id <> :deviceId")
    int clearFcmTokenFromOtherDevices(String token, long deviceId);
}
