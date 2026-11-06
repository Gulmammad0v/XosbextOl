package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "extra_services", indexes = @Index(
        name = "idx_extra_services_venue", columnList = "venue_id, active"))
@org.hibernate.annotations.Check(constraints = "price >= 0 and price_type in ('FIXED', 'PER_PERSON')")
@Getter @Setter @NoArgsConstructor
public class ExtraService {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "venue_id") private Venue venue;
    @Column(nullable = false, length = 150) private String name;
    @Column(length = 500) private String description;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal price;
    @Column(nullable = false, length = 15) private String priceType;
    private Boolean active = true;
}
