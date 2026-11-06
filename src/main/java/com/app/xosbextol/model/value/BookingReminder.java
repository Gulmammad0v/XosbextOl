package com.app.xosbextol.model.value;

import lombok.Value;
import lombok.experimental.Accessors;

@Value
@Accessors(fluent = true)
public class BookingReminder {
    long bookingId;
    long userId;
    String type;
    String date;
}
