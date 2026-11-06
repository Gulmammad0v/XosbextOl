package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class ReviewReplyRequestDto { @NotBlank @Size(max = 1000) private String text; }
