package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class ResetPasswordRequestDto {
    @NotBlank @Size(max=200) private String token;
    @NotBlank @Size(min=8,max=128) private String newPassword;
    @NotBlank @Size(min=8,max=128) private String confirmPassword;
}
