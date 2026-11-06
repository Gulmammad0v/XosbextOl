package com.app.xosbextol.model.value;

import lombok.*;
import lombok.experimental.Accessors;

import java.math.BigDecimal;
import java.time.*;

@Value
@Accessors(fluent = true)
public class BookingSnapshot {
    long id;
    long userId;
    long hallId;
    long venueId;
    LocalDate eventDate;
    String status;
    BigDecimal total;
    BigDecimal deposit;
    BigDecimal paid;
    Instant expiresAt;
}
