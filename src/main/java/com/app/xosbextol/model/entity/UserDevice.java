package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.DeviceStatus;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "user_devices", uniqueConstraints = @UniqueConstraint(name = "uq_user_device", columnNames = {"user_id", "device_id"}))
@Getter
@Setter
@NoArgsConstructor
public class UserDevice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "device_id", nullable = false, length = 64)
    private String deviceId;

    @Column(length = 100)
    private String deviceName;

    @Column(nullable = false, length = 10)
    private String platform;

    @Column(length = 20)
    private String osVersion;

    @Column(length = 20)
    private String appVersion;

    @Column(length = 500)
    private String fcmToken;

    @Column(nullable = false)
    private Instant lastActiveAt = Instant.now();

    @Column(length = 80)
    private String lastCity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private DeviceStatus status = DeviceStatus.ACTIVE;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
