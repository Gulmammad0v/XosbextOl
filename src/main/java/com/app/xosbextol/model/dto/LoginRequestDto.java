package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Data
@NoArgsConstructor
public class LoginRequestDto {
    @NotBlank
    @Email
    @Size(max = 254)
    private String email;
    @NotBlank
    @Size(min = 8, max = 128)
    private String password;
    @NotBlank @Size(max = 100)
    private String deviceName;
    @NotBlank @Size(min = 16, max = 64)
    private String deviceId;
    @NotNull @Pattern(regexp = "IOS|ANDROID")
    private String platform;
    @Size(max = 20) private String osVersion;
    @Size(max = 20) private String appVersion;
    @Size(max = 500) private String fcmToken;

    public LoginRequestDto(String email, String password, String deviceInfo) {
        this(email, password, deviceInfo, "00000000-0000-4000-8000-000000000001");
    }

    public LoginRequestDto(String email, String password, String deviceInfo, String deviceId) {
        setEmail(email);
        this.password = password;
        this.deviceName = deviceInfo;
        this.deviceId = deviceId;
        this.platform = "ANDROID";
    }

    public void setEmail(String email) {
        this.email = email == null ? null : com.app.xosbextol.util.EmailAddress.normalize(email);
    }
}
