package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "venue_halls", indexes = @Index(name = "idx_halls_venue", columnList = "venue_id, active"))
@org.hibernate.annotations.Check(constraints = "capacity_min > 0 and capacity_max >= capacity_min and price_per_person >= 0 and deposit_percent between 1 and 100")
@Getter
@Setter
@NoArgsConstructor
public class VenueHall extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;
    @Column(nullable = false, length = 150)
    private String name;
    private Integer capacityMin;
    private Integer capacityMax;
    @Column(precision = 12, scale = 2)
    private BigDecimal pricePerPerson;
    @Column(precision = 5, scale = 2)
    private BigDecimal depositPercent;
    private Boolean active = true;

    @OneToMany(mappedBy = "hall", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<HallBlockedDate> blockedDates = new java.util.ArrayList<>();

    public Long getVenueId() { return venue == null ? null : venue.getId(); }
}
