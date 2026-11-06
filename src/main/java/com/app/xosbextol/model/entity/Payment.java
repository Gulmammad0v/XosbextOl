package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.PaymentStatus;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payments", indexes = {
        @Index(name = "idx_payments_booking", columnList = "booking_id"),
        @Index(name = "idx_payments_user_id", columnList = "user_id"),
        @Index(name = "uq_payment_provider_tx", columnList = "provider, provider_tx_id", unique = true)
})
@org.hibernate.annotations.Check(constraints = "amount > 0")
@Getter
@Setter
@NoArgsConstructor
public class Payment extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(name = "booking_request", columnDefinition = "text")
    private String bookingRequest;
    @Column(length = 30)
    private String provider;
    @Column(length = 100)
    private String providerTxId;
    @Column(length = 100, unique = true)
    private String idempotencyKey;
    @Column(precision = 12, scale = 2)
    private BigDecimal amount;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.CHAR)
    @Column(columnDefinition = "char(3)", length = 3)
    private String currency = "AZN";
    @ManyToOne(optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private PaymentStatusReference statusReference = new PaymentStatusReference(PaymentStatus.INITIATED);
    @Column(length = 500)
    private String failureReason;
    @Column(length = 1000)
    private String checkoutUrl;
    private Instant paidAt;

    @OneToMany(mappedBy = "payment")
    private java.util.List<Refund> refunds = new java.util.ArrayList<>();

    public Long getBookingId() { return booking == null ? null : booking.getId(); }
    public Long getUserId() { return user == null ? null : user.getId(); }
    public PaymentStatus getStatus() { return statusReference == null ? null : statusReference.value(); }
    public void setStatus(PaymentStatus status) { statusReference = new PaymentStatusReference(java.util.Objects.requireNonNull(status)); }
}
