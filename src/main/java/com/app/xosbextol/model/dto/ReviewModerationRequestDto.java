package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class ReviewModerationRequestDto { @NotNull @Pattern(regexp = "VISIBLE|HIDDEN") private String status; }
