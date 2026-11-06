package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class CreateReviewRequestDto {
    @Positive private long bookingId;
    @Min(1) @Max(5) private int rating;
    @Min(1) @Max(5) private Integer ratingFood;
    @Min(1) @Max(5) private Integer ratingService;
    @Min(1) @Max(5) private Integer ratingHall;
    @Min(1) @Max(5) private Integer ratingValue;
    @Size(max = 2000) private String comment;

    public CreateReviewRequestDto(long bookingId, int rating, String comment) {
        this.bookingId = bookingId;
        this.rating = rating;
        this.comment = comment;
    }
}
