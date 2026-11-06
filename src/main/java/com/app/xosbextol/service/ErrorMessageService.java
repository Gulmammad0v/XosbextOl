package com.app.xosbextol.service;

import lombok.extern.log4j.Log4j2;
import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Log4j2
public class ErrorMessageService {
    private static final String DEFAULT_LANGUAGE = "az";
    private static final Set<String> SUPPORTED_LANGUAGES = Set.of("az", "en", "ru");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{([A-Za-z][A-Za-z0-9_]*)}");

    static final Set<String> ERROR_CODES = Set.of(
            "INTERNAL_ERROR", "VALIDATION_FAILED", "INVALID_REQUEST", "FORBIDDEN",
            "RESOURCE_NOT_FOUND", "BUSINESS_CONFLICT", "DATA_CONFLICT",
            "DATABASE_CONSTRAINT_VIOLATION", "BOOKING_DATE_NOT_AVAILABLE",
            "BOOKING_GUEST_COUNT_OUT_OF_RANGE", "BOOKING_CANCELLATION_DEADLINE_PASSED",
            "AUTH_TOKEN_EXPIRED", "AUTH_DEVICE_LIMIT_REACHED", "AUTH_INVALID_TOKEN",
            "AUTH_INVALID_CREDENTIALS", "AUTH_PASSWORD_LOGIN_UNAVAILABLE",
            "EMAIL_DELIVERY_FAILED", "RATE_LIMIT_EXCEEDED");

    private final MessageSource messages;

    public ErrorMessageService(MessageSource messages) {
        this.messages = messages;
    }

    public String resolve(String code, String requestedLanguage, Map<String, ?> params) {
        String language = SUPPORTED_LANGUAGES.contains(requestedLanguage) ? requestedLanguage : DEFAULT_LANGUAGE;
        Locale locale = Locale.forLanguageTag(language);
        String template;
        try {
            template = messages.getMessage("error." + code, null, locale);
        } catch (NoSuchMessageException exception) {
            log.error("Localized error message is missing code={} language={}", code, language);
            template = messages.getMessage("error.INTERNAL_ERROR", null,
                    "Gözlənilməyən xəta baş verdi.", locale);
        }
        return interpolate(template, params);
    }

    private String interpolate(String template, Map<String, ?> params) {
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuffer rendered = new StringBuffer();
        while (matcher.find()) {
            Object value = params.get(matcher.group(1));
            String replacement = value == null ? matcher.group() : String.valueOf(value);
            matcher.appendReplacement(rendered, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(rendered);
        return rendered.toString();
    }
}
