package com.app.xosbextol.model.dto;

import lombok.Value;
import java.time.Instant;

@Value
public class ReviewResponseDto {
    long id;
    long bookingId;
    String userName;
    int rating;
    Integer ratingFood;
    Integer ratingService;
    Integer ratingHall;
    Integer ratingValue;
    String comment;
    String ownerReply;
    String status;
    String moderationStatus;
    Instant createdAt;
    Instant editedAt;
}
