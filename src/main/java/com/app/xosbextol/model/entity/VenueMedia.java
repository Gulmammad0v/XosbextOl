package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "venue_media", indexes = @Index(name = "idx_media_venue", columnList = "venue_id, sort_order"))
@org.hibernate.annotations.Check(constraints = "type in ('IMAGE', 'VIDEO')")
@Getter @Setter @NoArgsConstructor
public class VenueMedia {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "venue_id") private Venue venue;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "hall_id") private VenueHall hall;
    @Column(nullable = false, length = 10) private String type;
    @Column(nullable = false, length = 500) private String url;
    @Column(length = 500) private String thumbUrl;
    @Column(length = 500) private String storageKey;
    @Column(unique = true, length = 64) private String contentHash;
    private Integer sortOrder = 0;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
}
