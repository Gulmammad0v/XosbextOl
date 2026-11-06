package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "venue_menu_packages", uniqueConstraints = @UniqueConstraint(columnNames = {"venue_id", "name"}))
@Getter @Setter @NoArgsConstructor
public class VenueMenuPackage extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(length = 500)
    private String description;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal pricePerPerson;
    @Column(nullable = false)
    private Integer tier;
    private Boolean popular = false;
    private Boolean active = true;

    @OneToMany(mappedBy = "menuPackage", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<VenueMenuPackageItem> packageItems = new ArrayList<>();
}
