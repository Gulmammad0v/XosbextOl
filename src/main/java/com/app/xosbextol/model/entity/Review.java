package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "reviews", indexes = @Index(name = "idx_reviews_venue", columnList = "venue_id, created_at"))
@org.hibernate.annotations.Check(constraints = "rating between 1 and 5 and status in ('VISIBLE', 'HIDDEN')")
@Getter @Setter @NoArgsConstructor
public class Review {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "booking_id", unique = true) private Booking booking;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id") private User user;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "venue_id") private Venue venue;
    private Short rating;
    private Short ratingFood;
    private Short ratingService;
    private Short ratingHall;
    private Short ratingValue;
    @Column(length = 2000) private String comment;
    @Column(nullable = false, length = 15) private String status = "VISIBLE";
    @Column(length = 1000) private String ownerReply;
    private Instant editedAt;
    private Instant reportedAt;
    @Column(length = 1000) private String reportReason;
    @Column(length = 20) private String moderationStatus = "NOT_REPORTED";
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
}
