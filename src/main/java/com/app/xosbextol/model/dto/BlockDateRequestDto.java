package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDate;

@Data @NoArgsConstructor @AllArgsConstructor
public class BlockDateRequestDto {
    @NotNull @FutureOrPresent private LocalDate date;
    @Size(max = 255) private String reason;
}
