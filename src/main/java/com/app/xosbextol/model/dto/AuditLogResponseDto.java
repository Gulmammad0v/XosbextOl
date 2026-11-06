package com.app.xosbextol.model.dto;
import lombok.Value;
import java.time.Instant;
@Value
public class AuditLogResponseDto {
    long id;
    Long actorId;
    String actorName;
    String action;
    String entityType;
    Long entityId;
    String entityName;
    Instant createdAt;
}
