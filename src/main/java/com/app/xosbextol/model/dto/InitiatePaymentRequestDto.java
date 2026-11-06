package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class InitiatePaymentRequestDto {
    @Positive private long bookingId;
}
