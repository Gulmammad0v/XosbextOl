package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity @Table(name = "reminder_deliveries")
@Getter @NoArgsConstructor
public class ReminderDelivery {
    @EmbeddedId
    @AttributeOverrides({
            @AttributeOverride(name = "bookingId", column = @Column(name = "booking_id")),
            @AttributeOverride(name = "reminderType", column = @Column(name = "reminder_type"))
    })
    private ReminderDeliveryId id;
    @MapsId("bookingId") @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "booking_id") private Booking booking;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();

    public ReminderDelivery(Booking booking, String reminderType) {
        this.id = new ReminderDeliveryId(booking.getId(), reminderType);
        this.booking = booking;
    }

    public String getReminderType() {
        return id == null ? null : id.getReminderType();
    }
}
