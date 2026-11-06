package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import jakarta.validation.constraints.NotNull;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class VenueVisibilityRequestDto {
    @NotNull Boolean frozen;
    @NotNull Boolean visible;
}
