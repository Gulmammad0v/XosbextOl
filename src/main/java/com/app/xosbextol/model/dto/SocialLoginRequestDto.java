package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class SocialLoginRequestDto {
    @NotNull @Pattern(regexp = "GOOGLE") String provider;
    @NotBlank @Size(max = 4000) String idToken;
    @NotBlank @Size(max = 200) String challenge;
    @NotBlank @Size(max = 100) String deviceName;
    @NotBlank @Size(min = 16, max = 64) String deviceId;
    @NotNull @Pattern(regexp = "IOS|ANDROID") String platform;
    @Size(max = 20) String osVersion;
    @Size(max = 20) String appVersion;
    @Size(max = 500) String fcmToken;
    @Size(max = 75) String firstName;
    @Size(max = 75) String lastName;
}
