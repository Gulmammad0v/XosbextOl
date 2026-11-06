package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.UserService;
import com.app.xosbextol.service.impl.AuthService;
import com.app.xosbextol.model.dto.ChangePasswordRequestDto;
import com.app.xosbextol.model.dto.DeviceTokenRequestDto;
import com.app.xosbextol.model.dto.UpdateUserRequestDto;
import com.app.xosbextol.model.dto.UserProfileResponseDto;
import com.app.xosbextol.model.dto.LanguagePreferenceRequestDto;
import com.app.xosbextol.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserController {
    private final UserService service;
    private final AuthService authService;

    @GetMapping
    UserProfileResponseDto me() {
        return service.profile(CurrentUser.id());
    }

    @PutMapping
    UserProfileResponseDto update(@Valid @RequestBody UpdateUserRequestDto request) {
        return service.update(CurrentUser.id(), request);
    }

    @PatchMapping("/language")
    UserProfileResponseDto updateLanguage(@Valid @RequestBody LanguagePreferenceRequestDto request) {
        return service.updateLanguage(CurrentUser.id(), request.language());
    }

    @PutMapping("/password")
    void changePassword(@Valid @RequestBody ChangePasswordRequestDto request) {
        authService.changePassword(CurrentUser.id(), request);
    }

    @PostMapping("/devices")
    void device(@Valid @RequestBody DeviceTokenRequestDto request) {
        service.registerDevice(CurrentUser.id(), CurrentUser.deviceId(), request);
    }

    @GetMapping("/devices")
    Object devices() {
        return authService.devices(CurrentUser.id(), CurrentUser.deviceId());
    }

    @DeleteMapping("/devices/{id}")
    void deleteDevice(@PathVariable long id) {
        authService.revokeDevice(CurrentUser.id(), id, CurrentUser.deviceId());
    }

    @DeleteMapping("/devices/others")
    void deleteOtherDevices() {
        authService.revokeOtherDevices(CurrentUser.id(), CurrentUser.deviceId());
    }
}
