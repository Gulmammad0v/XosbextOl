package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "venue_menu_items", uniqueConstraints = @UniqueConstraint(columnNames = {"category_id", "name"}))
@Getter @Setter @NoArgsConstructor
public class VenueMenuItem extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private VenueMenuCategory category;
    @Column(nullable = false, length = 160)
    private String name;
    @Column(length = 500)
    private String description;
    private Boolean seasonal = false;
    @Column(nullable = false, columnDefinition = "boolean default false")
    private Boolean customizable = false;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal additionalPricePerPerson = BigDecimal.ZERO;
    private Boolean active = true;
}
