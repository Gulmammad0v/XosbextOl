package com.app.xosbextol.model.dto;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class TokenResponseDto { private String accessToken; private String refreshToken; private long expiresIn; private String tokenType; }
