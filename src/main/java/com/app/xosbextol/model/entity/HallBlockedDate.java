package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "hall_blocked_dates", uniqueConstraints = @UniqueConstraint(
        name = "uq_hall_blocked_date", columnNames = {"hall_id", "blocked_date"}))
@Getter @Setter @NoArgsConstructor
public class HallBlockedDate {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "hall_id", nullable = false) private VenueHall hall;
    @Column(nullable = false) private LocalDate blockedDate;
    @Column(length = 255) private String reason;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by") private User createdBy;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
}
