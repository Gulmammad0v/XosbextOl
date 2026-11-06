package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.NotificationOutbox;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface NotificationOutboxRepository extends JpaRepository<NotificationOutbox, Long> {
    @Modifying
    @Query("delete from NotificationOutbox o where o.notification.id in :ids and o.notification.user.id = :userId")
    int deleteOwned(List<Long> ids, long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from NotificationOutbox o join fetch o.notification where o.notification.id = :notificationId")
    Optional<NotificationOutbox> lockByNotificationId(long notificationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from NotificationOutbox o join fetch o.notification where o.status = 'PENDING' and o.nextAttemptAt <= :now order by o.id")
    List<NotificationOutbox> lockPending(Instant now, Pageable pageable);
}
