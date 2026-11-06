package com.app.xosbextol.model.dto;

import lombok.*;
import java.time.LocalDate;

@Data @NoArgsConstructor @AllArgsConstructor
public class BlockedDateResponseDto {
    private long id;
    private LocalDate blockedDate;
    private String reason;
}
