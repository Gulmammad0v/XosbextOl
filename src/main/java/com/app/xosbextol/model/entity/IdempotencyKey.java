package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity @Table(name = "idempotency_keys")
@Getter @Setter @NoArgsConstructor
public class IdempotencyKey {
    @Id @Column(length = 100) private String key;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "user_id") private User user;
    @Column(length = 128) private String requestHash;
    private Integer responseStatus;
    @Column(columnDefinition = "jsonb") @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private java.util.Map<String, Object> responseBody;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
}
