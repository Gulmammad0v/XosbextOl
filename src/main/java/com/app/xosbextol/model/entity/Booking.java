package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.BookingEventType;
import com.app.xosbextol.model.enums.BookingStatus;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.*;

@Entity
@Table(name = "bookings", indexes = {
        @Index(name = "idx_bookings_hall_date", columnList = "hall_id, event_date"),
        @Index(name = "idx_bookings_user", columnList = "user_id, created_at")
})
@org.hibernate.annotations.Check(constraints = "guest_count > 0 and total_price >= 0 and deposit_amount >= 0 and deposit_amount <= total_price")
@Getter
@Setter
@NoArgsConstructor
public class Booking extends BaseEntity {
    @Column(nullable = false, unique = true, length = 20)
    private String bookingNumber;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hall_id", nullable = false)
    private VenueHall hall;
    @Column(nullable = false)
    private LocalDate eventDate;
    private Integer guestCount;
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private BookingEventType eventType;
    @Column(precision = 12, scale = 2)
    private BigDecimal hallPrice;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_package_id")
    private VenueMenuPackage menuPackage;
    @Column(precision = 12, scale = 2)
    private BigDecimal menuCustomizationPrice = BigDecimal.ZERO;
    @Column(precision = 12, scale = 2)
    private BigDecimal servicesPrice = BigDecimal.ZERO;
    @Column(precision = 12, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;
    @Column(precision = 12, scale = 2)
    private BigDecimal totalPrice;
    @Column(precision = 12, scale = 2)
    private BigDecimal depositAmount;
    @Column(precision = 12, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "promo_code_id")
    private PromoCode promoCode;
    @ManyToOne(optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private BookingStatusReference statusReference = new BookingStatusReference(BookingStatus.PENDING_APPROVAL);
    private Instant expiresAt;
    private Instant cancelledAt;
    @Column(length = 500)
    private String cancelReason;
    private Instant reviewPromptSentAt;
    @Column(length = 1000)
    private String customerNote;
    @Version
    private Long version;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<BookingExtraService> extraServices = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<BookingMenuItem> menuItems = new java.util.ArrayList<>();

    @OneToMany(mappedBy = "booking")
    private java.util.List<Payment> payments = new java.util.ArrayList<>();

    public Long getUserId() {
        return user == null ? null : user.getId();
    }

    public Long getHallId() {
        return hall == null ? null : hall.getId();
    }

    public Long getPromoCodeId() {
        return promoCode == null ? null : promoCode.getId();
    }

    public BookingStatus getStatus() {
        return statusReference == null ? null : statusReference.value();
    }

    public void setStatus(BookingStatus status) {
        statusReference = new BookingStatusReference(java.util.Objects.requireNonNull(status));
    }
}
