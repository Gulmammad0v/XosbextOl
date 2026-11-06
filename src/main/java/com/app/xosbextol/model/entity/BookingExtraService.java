package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "booking_extra_services", indexes = @Index(
        name = "idx_booking_services_booking", columnList = "booking_id"))
@org.hibernate.annotations.Check(constraints = "quantity > 0 and unit_price >= 0 and total_price >= 0")
@Getter @Setter @NoArgsConstructor
public class BookingExtraService {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "booking_id") private Booking booking;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "service_id") private ExtraService service;
    private Integer quantity = 1;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal unitPrice;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal totalPrice;
}
