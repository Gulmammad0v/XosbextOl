package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "favorites")
@Getter
@NoArgsConstructor
public class Favorite {
    @EmbeddedId
    private FavoriteId id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @MapsId("venueId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Favorite(User user, Venue venue) {
        this.id = new FavoriteId(user.getId(), venue.getId());
        this.user = user;
        this.venue = venue;
    }
}
