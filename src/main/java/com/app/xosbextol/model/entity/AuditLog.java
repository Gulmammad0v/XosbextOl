package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_created", columnList = "created_at"),
        @Index(name = "idx_audit_entity", columnList = "entity_type, entity_id")
})
@Getter
@Setter
@NoArgsConstructor
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;
    @Column(nullable = false, length = 60)
    private String action;
    @Column(nullable = false, length = 40)
    private String entityType;
    private Long entityId;
    @Column(length = 45)
    private String ipAddress;
    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
