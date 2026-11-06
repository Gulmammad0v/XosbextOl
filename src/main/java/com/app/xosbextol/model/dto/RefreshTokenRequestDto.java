package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RefreshTokenRequestDto {
    @NotBlank @Size(max = 200) private String refreshToken;
    @NotBlank @Size(min = 16, max = 64) private String deviceId;

    public RefreshTokenRequestDto(String refreshToken) {
        this(refreshToken, null);
    }
}
