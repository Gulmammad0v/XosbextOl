package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AdminLoginRequestDto {
    @NotBlank
    @Email
    @Size(max = 254)
    private String email;

    @NotBlank
    @Size(min = 8, max = 128)
    private String password;

    public void setEmail(String email) {
        this.email = email == null ? null : com.app.xosbextol.util.EmailAddress.normalize(email);
    }
}
