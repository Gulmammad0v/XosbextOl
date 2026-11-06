package com.app.xosbextol.handler;

import com.app.xosbextol.service.ErrorMessageService;
import com.app.xosbextol.service.RequestLanguageResolver;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import java.sql.SQLException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GlobalExceptionHandlerTest {
    @Test
    void checkViolationIsReportedAsInvalidDataInsteadOfDuplicateData() {
        var cause = new SQLException("check constraint failed", "23514");
        var exception = new DataIntegrityViolationException("insert failed", cause);

        var messages = mock(ErrorMessageService.class);
        var languages = mock(RequestLanguageResolver.class);
        var request = mock(HttpServletRequest.class);
        when(languages.resolve(request)).thenReturn("az");
        when(messages.resolve(eq("DATABASE_CONSTRAINT_VIOLATION"), eq("az"), anyMap()))
                .thenReturn("Göndərilən məlumat qaydalara uyğun deyil.");
        var response = new GlobalExceptionHandler(messages, languages).conflict(exception, request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("DATABASE_CONSTRAINT_VIOLATION", response.getBody().get("code"));
        assertEquals("Göndərilən məlumat qaydalara uyğun deyil.",
                ((Map<?, ?>) response.getBody()).get("message"));
    }
}
