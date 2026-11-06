package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
@Data @NoArgsConstructor
public class VerifyOtpRequestDto {
    @NotBlank @Email @Size(max=254) private String email;
    @NotBlank @Pattern(regexp="[0-9]{6}") private String code;
    public VerifyOtpRequestDto(String email,String code){setEmail(email);this.code=code;}
    public void setEmail(String email) { this.email=email==null?null:com.app.xosbextol.util.EmailAddress.normalize(email); }
}
