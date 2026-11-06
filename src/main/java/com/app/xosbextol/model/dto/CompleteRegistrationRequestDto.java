package com.app.xosbextol.model.dto;
import com.app.xosbextol.model.enums.Role;
import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDate;
@Data @NoArgsConstructor @AllArgsConstructor
public class CompleteRegistrationRequestDto {
    @NotBlank @Size(max=200) private String token;
    @NotBlank @Size(min=2,max=75) private String firstName;
    @NotBlank @Size(min=2,max=75) private String lastName;
    @NotNull @Past private LocalDate birthDate;
    @NotNull private Role role = Role.CUSTOMER;
    @Pattern(regexp="^(?:\\+?[1-9][0-9]{7,14}|0[0-9]{9})$") private String phone;
    @NotBlank @Size(min=8,max=128) private String password;
    @NotBlank @Size(min=8,max=128) private String confirmPassword;
    @NotBlank @Size(max=100) private String deviceName;
    @NotBlank @Size(min=16,max=64) private String deviceId;
    @NotNull @Pattern(regexp="IOS|ANDROID") private String platform;
    @Size(max=20) private String osVersion;
    @Size(max=20) private String appVersion;
    @Size(max=500) private String fcmToken;

    public CompleteRegistrationRequestDto(String token, String firstName, String lastName, LocalDate birthDate,
                                          String password, String confirmPassword, String deviceInfo) {
        this(token, firstName, lastName, birthDate, Role.CUSTOMER, null, password, confirmPassword,
                deviceInfo, "00000000-0000-4000-8000-000000000001", "ANDROID", null, null, null);
    }

    public CompleteRegistrationRequestDto(String token, String firstName, String lastName, LocalDate birthDate,
                                          Role role, String phone, String password, String confirmPassword,
                                          String deviceInfo) {
        this(token, firstName, lastName, birthDate, role, phone, password, confirmPassword,
                deviceInfo, "00000000-0000-4000-8000-000000000001", "ANDROID", null, null, null);
    }

    public CompleteRegistrationRequestDto(String token, String firstName, String lastName, LocalDate birthDate,
                                          Role role, String phone, String password, String confirmPassword,
                                          String deviceName, String deviceId) {
        this(token, firstName, lastName, birthDate, role, phone, password, confirmPassword,
                deviceName, deviceId, "ANDROID", null, null, null);
    }
}
