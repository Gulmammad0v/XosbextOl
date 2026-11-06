package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "booking_menu_items", uniqueConstraints = @UniqueConstraint(columnNames = {"booking_id", "menu_item_id"}))
@Getter @Setter @NoArgsConstructor
public class BookingMenuItem {
    public enum Action { REMOVED, ADDED }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "menu_item_id", nullable = false)
    private VenueMenuItem menuItem;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Action action;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;
}
