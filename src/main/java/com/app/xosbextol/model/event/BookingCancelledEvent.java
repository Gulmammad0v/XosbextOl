package com.app.xosbextol.model.event;

import java.math.BigDecimal;
import lombok.Value;
import lombok.experimental.Accessors;

@Value @Accessors(fluent = true)
public class BookingCancelledEvent {
    long bookingId;
    String bookingNumber;
    long userId;
    BigDecimal paidAmount;
    BigDecimal depositAmount;
    String reason;
}
