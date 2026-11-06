package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class RejectBookingRequestDto {
    @NotBlank @Size(max = 500) String reason;
}
