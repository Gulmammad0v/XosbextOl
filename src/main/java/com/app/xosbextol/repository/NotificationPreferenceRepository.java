package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.NotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {
    List<NotificationPreference> findByUser_Id(long userId);
    Optional<NotificationPreference> findByUser_IdAndCategory(long userId, String category);
}
