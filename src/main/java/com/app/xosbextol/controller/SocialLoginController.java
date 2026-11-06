package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.SocialLoginService;
import com.app.xosbextol.model.dto.SocialChallengeRequestDto;
import com.app.xosbextol.model.dto.SocialLoginRequestDto;
import com.app.xosbextol.model.dto.TokenResponseDto;
import com.app.xosbextol.security.CurrentUser;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class SocialLoginController {
    private final SocialLoginService service;

    @PostMapping("/api/auth/social/challenge")
    Map<String, String> challenge(@Valid @RequestBody SocialChallengeRequestDto req, HttpServletRequest http) {
        return service.challenge(req.provider(), null, http.getRemoteAddr());
    }

    @PostMapping("/api/auth/social/login")
    TokenResponseDto login(@Valid @RequestBody SocialLoginRequestDto req) {
        return service.login(req);
    }

    @PostMapping("/api/users/me/social/challenge")
    Map<String, String> linkChallenge(@Valid @RequestBody SocialChallengeRequestDto req, HttpServletRequest http) {
        return service.challenge(req.provider(), CurrentUser.id(), http.getRemoteAddr());
    }

    @PostMapping("/api/users/me/social")
    void link(@Valid @RequestBody SocialLoginRequestDto req) {
        service.link(CurrentUser.id(), req);
    }
}
