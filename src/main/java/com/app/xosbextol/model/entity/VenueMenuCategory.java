package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "venue_menu_categories", uniqueConstraints = @UniqueConstraint(columnNames = {"venue_id", "name"}))
@Getter @Setter @NoArgsConstructor
public class VenueMenuCategory extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false)
    private Integer sortOrder;
    private Boolean defaultCustomizable;
    @Column(precision = 12, scale = 2)
    private BigDecimal defaultPricePerPerson;
}
