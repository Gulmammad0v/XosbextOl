package com.app.xosbextol.model.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;

import java.math.BigDecimal;

@Value
@Builder
@Accessors(fluent = true)
@AllArgsConstructor
public class BookingRejectedEvent {
    long bookingId;
    String bookingNumber;
    long userId;
    BigDecimal paidAmount;
    String reason;
}
