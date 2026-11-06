package com.app.xosbextol.service;

import org.junit.jupiter.api.Test;
import org.springframework.context.support.ResourceBundleMessageSource;

import java.util.Locale;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ErrorMessageServiceTest {
    private final ResourceBundleMessageSource source = messageSource();
    private final ErrorMessageService service = new ErrorMessageService(source);

    @Test
    void everyErrorCodeHasAllSupportedTranslations() {
        for (String code : ErrorMessageService.ERROR_CODES) {
            for (String language : new String[]{"az", "en", "ru"}) {
                String message = source.getMessage("error." + code, null, Locale.forLanguageTag(language));
                assertFalse(message.isBlank(), () -> code + " is missing for " + language);
            }
        }
    }

    @Test
    void namedParametersAreInterpolated() {
        assertEquals("The guest count must be between 10 and 20.", service.resolve(
                "BOOKING_GUEST_COUNT_OUT_OF_RANGE", "en", Map.of("min", 10, "max", 20)));
    }

    private static ResourceBundleMessageSource messageSource() {
        var source = new ResourceBundleMessageSource();
        source.setBasename("messages");
        source.setDefaultEncoding("UTF-8");
        return source;
    }
}
