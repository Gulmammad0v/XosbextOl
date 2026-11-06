package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import java.time.Instant;
import java.time.LocalDate;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class ReviewEligibilityResponseDto {
    long bookingId;
    long venueId;
    String venueName;
    String coverImageUrl;
    LocalDate eventDate;
    int guestCount;
    boolean eligible;
    LocalDate opensOn;
    LocalDate closesOn;
    boolean editable;
    Instant editableUntil;
    ReviewResponseDto review;
}
