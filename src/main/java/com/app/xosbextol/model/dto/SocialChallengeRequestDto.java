package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class SocialChallengeRequestDto {
    @NotNull @Pattern(regexp = "GOOGLE") String provider;
}
