package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.AuthService;
import com.app.xosbextol.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class SessionManagementController {
    private final AuthService auth;

    @GetMapping("/api/users/me/sessions")
    Object sessions() {
        return auth.devices(CurrentUser.id(), CurrentUser.deviceId()).devices();
    }

    @DeleteMapping("/api/users/me/sessions/{id}")
    void revoke(@PathVariable long id) {
        auth.revokeDevice(CurrentUser.id(), id, CurrentUser.deviceId());
    }
}
