package com.app.xosbextol.model.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;

import java.time.LocalDate;

@Value
@Builder
@Accessors(fluent = true)
@AllArgsConstructor
public class BookingApprovalRequestedEvent {
    long bookingId;
    String bookingNumber;
    long ownerId;
    LocalDate eventDate;
    String hallName;
}
