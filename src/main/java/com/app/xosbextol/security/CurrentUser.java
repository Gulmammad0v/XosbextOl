package com.app.xosbextol.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Objects;

public final class CurrentUser {
    private CurrentUser() {
    }

    public static long id() {
        return Long.parseLong(Objects.requireNonNull(jwt().getSubject()));
    }

    public static Long deviceId() {
        Number value = jwt().getClaim("device_id");
        return value == null ? null : value.longValue();
    }

    private static Jwt jwt() {
        return (Jwt) Objects.requireNonNull(Objects.requireNonNull(
                SecurityContextHolder.getContext().getAuthentication()).getPrincipal());
    }
}
