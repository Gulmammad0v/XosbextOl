package com.app.xosbextol.service;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class RequestLanguageResolver {
    private static final String DEFAULT_LANGUAGE = "az";
    private static final List<String> SUPPORTED_TAGS = List.of("az", "en", "ru");
    private static final Set<String> SUPPORTED = Set.copyOf(SUPPORTED_TAGS);
    private final UserAccess users;

    public String resolve(HttpServletRequest request) {
        String header = request.getHeader("Accept-Language");
        if (header != null && !header.isBlank()) {
            try {
                String match = Locale.lookupTag(Locale.LanguageRange.parse(header), SUPPORTED_TAGS);
                if (match != null) return match;
            } catch (IllegalArgumentException ignored) {
                // Malformed client headers fall through to the saved preference.
            }
        }
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            try {
                String language = users.contact(Long.parseLong(jwt.getSubject())).language();
                return SUPPORTED.contains(language) ? language : DEFAULT_LANGUAGE;
            } catch (RuntimeException ignored) {
                // Error rendering must never fail because the preference lookup failed.
            }
        }
        return DEFAULT_LANGUAGE;
    }
}
