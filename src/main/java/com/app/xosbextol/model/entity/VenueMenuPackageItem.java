package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "venue_menu_package_items", uniqueConstraints = @UniqueConstraint(columnNames = {"menu_package_id", "menu_item_id"}))
@Getter @Setter @NoArgsConstructor
public class VenueMenuPackageItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "menu_package_id", nullable = false)
    private VenueMenuPackage menuPackage;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "menu_item_id", nullable = false)
    private VenueMenuItem menuItem;
}
