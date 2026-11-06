package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.VenueStatus;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.time.Instant;

@Entity
@Table(name = "venues", indexes = {
        @Index(name = "idx_venues_owner", columnList = "owner_id"),
        @Index(name = "idx_venues_city", columnList = "city")
})
@org.hibernate.annotations.Check(constraints = "latitude between -90 and 90 and longitude between -180 and 180")
@Getter
@Setter
@NoArgsConstructor
public class Venue extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(nullable = false, unique = true, length = 220)
    private String slug;
    @Column(columnDefinition = "text")
    private String description;
    @Column(nullable = false, length = 500)
    private String address;
    @Column(length = 80)
    private String city;
    @Column(precision = 9, scale = 6, nullable = false)
    private BigDecimal latitude;
    @Column(precision = 9, scale = 6, nullable = false)
    private BigDecimal longitude;
    @ManyToOne(optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private VenueStatusReference statusReference = new VenueStatusReference(VenueStatus.PENDING);
    @Column(precision = 3, scale = 2)
    private BigDecimal ratingAvg = BigDecimal.ZERO;
    private Integer ratingCount = 0;
    @Column(length = 200)
    private String legalName;
    @Column(length = 20)
    private String taxId;
    @Column(length = 7)
    private String finCode;
    @Column(length = 500)
    private String companyDocumentUrl;
    @Column(length = 500)
    private String ownerIdentityDocumentUrl;
    @Column(length = 40)
    private String agreementVersion;
    private Instant agreementAcceptedAt;
    @Column(length = 200)
    private String agreementSignedBy;
    private Instant submittedAt;
    private Instant approvedAt;
    @Column(length = 1000)
    private String rejectionReason;
    private Boolean visible = true;
    private Boolean frozen = false;

    @Column(length = 200)
    private String pendingName;
    @Column(length = 500)
    private String pendingAddress;
    @Column(length = 80)
    private String pendingCity;
    @Column(precision = 9, scale = 6)
    private BigDecimal pendingLatitude;
    @Column(precision = 9, scale = 6)
    private BigDecimal pendingLongitude;
    @Column(length = 20)
    private String criticalChangeStatus;
    @Column(length = 1000)
    private String criticalChangeReason;
    @Column(columnDefinition = "text")
    private String changeReviewSnapshot;

    @Column(length = 30)
    private String companyEditStatus;
    @Column(length = 1000)
    private String companyEditRequestMessage;
    private Instant companyEditRequestedAt;
    private Instant companyEditAllowedUntil;
    private Instant companyEditUsedAt;
    @Column(length = 1000)
    private String companyEditDecisionReason;
    @Column(columnDefinition = "text")
    private String companyEditSnapshot;

    @OneToMany(mappedBy = "venue", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<VenueHall> halls = new ArrayList<>();

    @ManyToMany
    @JoinTable(name = "venue_amenities",
            joinColumns = @JoinColumn(name = "venue_id"),
            inverseJoinColumns = @JoinColumn(name = "amenity_id"))
    private Set<Amenity> amenities = new HashSet<>();

    public Long getOwnerId() {
        return owner == null ? null : owner.getId();
    }

    public VenueStatus getStatus() {
        return statusReference == null ? null : statusReference.value();
    }

    public void setStatus(VenueStatus status) {
        statusReference = new VenueStatusReference(java.util.Objects.requireNonNull(status));
    }
}
