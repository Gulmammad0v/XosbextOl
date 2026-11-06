package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "notification_preferences", uniqueConstraints = @UniqueConstraint(
        name = "uq_notification_preference_user_category", columnNames = {"user_id", "category"}))
@Getter
@Setter
@NoArgsConstructor
public class NotificationPreference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 32)
    private String category;

    @Column(nullable = false)
    private boolean enabled;
}
