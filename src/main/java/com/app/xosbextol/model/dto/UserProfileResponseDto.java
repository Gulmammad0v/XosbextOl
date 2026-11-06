package com.app.xosbextol.model.dto;

import lombok.*;
import java.time.Instant;

@Value
public class UserProfileResponseDto {
    long id;
    String email;
    String phone;
    String fullName;
    String avatarUrl;
    String role;
    String language;
    boolean hasPassword;
    Instant createdAt;
}
