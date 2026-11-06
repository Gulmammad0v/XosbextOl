package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record LanguagePreferenceRequestDto(
        @NotBlank @Pattern(regexp = "az|en|ru") String language
) {
}
