package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class CancelBookingRequestDto {
    @NotBlank @Size(max = 500) private String reason;
}
