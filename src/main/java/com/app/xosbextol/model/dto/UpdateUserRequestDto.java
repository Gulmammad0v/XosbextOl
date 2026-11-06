package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class UpdateUserRequestDto {
    @NotBlank @Size(max=150) private String fullName;
    @NotBlank @Pattern(regexp="az|ru|en") private String language;
    @Pattern(regexp="^\\+994[0-9]{9}$", message="Telefon nömrəsini +994501234567 formatında daxil edin")
    private String phone;
}
