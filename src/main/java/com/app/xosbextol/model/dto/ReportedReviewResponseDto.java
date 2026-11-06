package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import java.time.Instant;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class ReportedReviewResponseDto {
    ReviewResponseDto review;
    long venueId;
    String venueName;
    String reportReason;
    Instant reportedAt;
}
