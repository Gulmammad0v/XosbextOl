package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class SendOtpRequestDto {
    @NotBlank @Email @Size(max=254) private String email;
    public void setEmail(String email) { this.email=email==null?null:com.app.xosbextol.util.EmailAddress.normalize(email); }
}
