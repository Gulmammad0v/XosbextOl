package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "refunds", indexes = @Index(name = "idx_refunds_booking", columnList = "booking_id"))
@org.hibernate.annotations.Check(constraints = "amount > 0 and status in ('REQUESTED', 'PROCESSED', 'FAILED')")
@Getter @Setter @NoArgsConstructor
public class Refund {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "payment_id", unique = true) private Payment payment;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "booking_id") private Booking booking;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Column(length = 500) private String reason;
    @Column(nullable = false, length = 15) private String status = "REQUESTED";
    @Column(length = 100) private String providerRef;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    private Instant processedAt;
}
