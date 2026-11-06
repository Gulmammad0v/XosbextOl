package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.AuthService;
import com.app.xosbextol.model.dto.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService service;

    @PostMapping("/register/otp/send")
    void sendRegistrationOtp(@Valid @RequestBody SendOtpRequestDto req, HttpServletRequest http) {
        service.sendRegistrationOtp(req, http.getRemoteAddr());
    }

    @PostMapping("/register/otp/verify")
    OtpChallengeResponseDto verifyRegistrationOtp(@Valid @RequestBody VerifyOtpRequestDto req, HttpServletRequest http) {
        return service.verifyRegistrationOtp(req, http.getRemoteAddr());
    }

    @PostMapping("/register/complete")
    TokenResponseDto completeRegistration(@Valid @RequestBody CompleteRegistrationRequestDto req) {
        return service.completeRegistration(req);
    }

    @PostMapping("/login")
    TokenResponseDto login(@Valid @RequestBody LoginRequestDto req, HttpServletRequest http) {
        return service.login(req, http.getRemoteAddr());
    }

    @PostMapping("/admin/login")
    TokenResponseDto adminLogin(@Valid @RequestBody AdminLoginRequestDto req, HttpServletRequest http) {
        return service.adminLogin(req, http.getRemoteAddr());
    }

    @PostMapping("/password/forgot/otp/send")
    void sendResetOtp(@Valid @RequestBody SendOtpRequestDto req, HttpServletRequest http) {
        service.sendPasswordResetOtp(req, http.getRemoteAddr());
    }

    @PostMapping("/password/forgot/otp/verify")
    OtpChallengeResponseDto verifyResetOtp(@Valid @RequestBody VerifyOtpRequestDto req, HttpServletRequest http) {
        return service.verifyPasswordResetOtp(req, http.getRemoteAddr());
    }

    @PostMapping("/password/reset")
    void resetPassword(@Valid @RequestBody ResetPasswordRequestDto req) {
        service.resetPassword(req);
    }

    @PostMapping("/refresh")
    TokenResponseDto refresh(@Valid @RequestBody RefreshTokenRequestDto req) {
        return service.refresh(req);
    }

    @PostMapping("/logout")
    void logout(@Valid @RequestBody RefreshTokenRequestDto req) {
        service.logout(req);
    }

    @PostMapping("/devices/{id}/revoke")
    TokenResponseDto replaceDevice(@PathVariable long id, @Valid @RequestBody DeviceReplacementRequestDto req) {
        return service.replaceDevice(id, req);
    }
}
