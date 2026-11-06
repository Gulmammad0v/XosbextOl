package com.app.xosbextol.model.dto;

import com.app.xosbextol.model.enums.VenueStatus;
import jakarta.validation.constraints.*;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class VenueDecisionRequestDto {
    @NotNull private VenueStatus status;
    @Size(max = 1000) private String reason;
}
