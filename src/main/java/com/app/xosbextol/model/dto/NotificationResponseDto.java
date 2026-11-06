package com.app.xosbextol.model.dto;
import lombok.Value;
import java.time.Instant;
@Value
public class NotificationResponseDto {
    long id; String type; String title; String body; String deepLink; boolean read; Instant readAt; Instant createdAt;
}
