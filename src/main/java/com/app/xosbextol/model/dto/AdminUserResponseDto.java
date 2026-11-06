package com.app.xosbextol.model.dto;
import lombok.Value;
import java.time.Instant;
@Value
public class AdminUserResponseDto { long id; String email; String fullName; String role; String status; Instant createdAt; }
