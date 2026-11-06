package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    @Query("select n from Notification n where n.user.id = :userId")
    Page<Notification> findVisible(long userId, Pageable pageable);

    @Query("select n from Notification n where n.id = :id and n.user.id = :userId")
    Optional<Notification> findVisibleById(long id, long userId);

    @Query("select count(n) from Notification n where n.user.id = :userId and n.readAt is null")
    long countUnread(long userId);
    boolean existsByUser_IdAndDedupKey(long userId, String dedupKey);

    @Modifying
    @Query("update Notification n set n.readAt = :now where n.user.id = :userId and n.readAt is null")
    int markAllRead(long userId, java.time.Instant now);

    @Modifying
    @Query("delete from Notification n where n.id in :ids and n.user.id = :userId")
    int deleteOwned(List<Long> ids, long userId);
}
