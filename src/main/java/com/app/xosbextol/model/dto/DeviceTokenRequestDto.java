package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class DeviceTokenRequestDto {
    @NotBlank @Size(max=500) private String token;
    @NotNull @Pattern(regexp="ANDROID|IOS") private String platform;
}
