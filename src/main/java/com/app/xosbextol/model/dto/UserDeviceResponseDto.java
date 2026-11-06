package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import java.time.Instant;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class UserDeviceResponseDto {
    long id;
    String deviceName;
    String platform;
    String osVersion;
    String appVersion;
    Instant lastActiveAt;
    String lastCity;
    String status;
    boolean notificationsEnabled;
    boolean current;
}
