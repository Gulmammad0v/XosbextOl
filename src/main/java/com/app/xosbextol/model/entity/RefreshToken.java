package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "refresh_tokens", indexes = {
        @Index(name = "idx_refresh_tokens_device_id", columnList = "device_id"),
        @Index(name = "idx_refresh_tokens_user", columnList = "user_id")
})
@Getter @Setter @NoArgsConstructor
public class RefreshToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id") private User user;
    @Column(nullable = false, unique = true, length = 128) private String tokenHash;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "device_id", nullable = false)
    private UserDevice device;
    @Column(nullable = false) private Instant expiresAt;
    private Boolean revoked = false;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
}
