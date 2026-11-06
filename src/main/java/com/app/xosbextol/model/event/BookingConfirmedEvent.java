package com.app.xosbextol.model.event;

import java.time.LocalDate;

import lombok.Value;
import lombok.experimental.Accessors;

@Value
@Accessors(fluent = true)
public class BookingConfirmedEvent {
    long bookingId;
    String bookingNumber;
    long userId;
    long venueId;
    LocalDate eventDate;
}
