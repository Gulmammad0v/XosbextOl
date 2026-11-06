package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

@Entity
@Table(name = "notifications",
        uniqueConstraints = @UniqueConstraint(name = "uq_notif_dedup", columnNames = {"user_id", "dedup_key"}),
        indexes = @Index(name = "idx_notifications_user", columnList = "user_id, created_at"))
@org.hibernate.annotations.Check(constraints = "push_status in ('PENDING', 'SENT', 'SKIPPED', 'FAILED')")
@Getter @Setter @NoArgsConstructor
public class Notification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id") private User user;
    @Column(nullable = false, length = 40) private String type;
    @Column(length = 200) private String title;
    @Column(length = 1000) private String body;
    @Column(length = 200) private String deepLink;
    @Column(length = 120) private String dedupKey;
    private Instant readAt;
    @ColumnDefault("'PENDING'")
    @Column(length = 10, nullable = false) private String pushStatus = "PENDING";
    private Instant pushSentAt;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();

    @Transient
    public boolean isRead() {
        return readAt != null;
    }
}
