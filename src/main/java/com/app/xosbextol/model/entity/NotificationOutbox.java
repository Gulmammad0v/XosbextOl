package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "notification_outbox", indexes = @Index(
        name = "idx_notification_outbox_pending", columnList = "status, next_attempt_at"))
@org.hibernate.annotations.Check(constraints = "status in ('PENDING', 'QUEUED', 'SENT', 'DEAD')")
@Getter @Setter @NoArgsConstructor
public class NotificationOutbox {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "notification_id", unique = true) private Notification notification;
    @Column(nullable = false, length = 15) private String status = "PENDING";
    private Integer attempts = 0;
    @Column(nullable = false) private Instant nextAttemptAt = Instant.now();
    private Instant publishedAt;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
}
