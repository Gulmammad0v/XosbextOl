package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class UpdateReviewRequestDto {
    @Min(1) @Max(5) private int rating;
    @Min(1) @Max(5) private Integer ratingFood;
    @Min(1) @Max(5) private Integer ratingService;
    @Min(1) @Max(5) private Integer ratingHall;
    @Min(1) @Max(5) private Integer ratingValue;
    @Size(max = 2000) private String comment;
}
