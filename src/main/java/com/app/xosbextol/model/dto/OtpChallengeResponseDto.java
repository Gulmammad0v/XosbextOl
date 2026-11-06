package com.app.xosbextol.model.dto;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class OtpChallengeResponseDto { private String token; private long expiresIn; }
