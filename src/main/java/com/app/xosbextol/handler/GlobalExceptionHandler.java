package com.app.xosbextol.handler;

import com.app.xosbextol.handler.customExceptions.ApiException;
import com.app.xosbextol.handler.customExceptions.DeviceLimitException;
import com.app.xosbextol.service.ErrorMessageService;
import com.app.xosbextol.service.RequestLanguageResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestControllerAdvice
@RequiredArgsConstructor
@Log4j2
public class GlobalExceptionHandler {
    private final ErrorMessageService messages;
    private final RequestLanguageResolver languages;

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String code, Map<String, ?> params,
                                                       HttpServletRequest request) {
        String language = languages.resolve(request);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", code);
        body.put("message", messages.resolve(code, language, params));
        body.put("params", params);
        body.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(DeviceLimitException.class)
    ResponseEntity<Map<String, Object>> deviceLimit(DeviceLimitException ex, HttpServletRequest request) {
        log.warn("Device limit reached deviceLimit={}", ex.deviceLimit());
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("limitToken", ex.limitToken());
        params.put("deviceLimit", ex.deviceLimit());
        params.put("devices", ex.devices());
        return error(HttpStatus.CONFLICT, "AUTH_DEVICE_LIMIT_REACHED", params, request);
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> api(ApiException ex, HttpServletRequest request) {
        log.warn("API request rejected code={} status={}", ex.code(), ex.status().value());
        return error(ex.status(), ex.code(), ex.params(), request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String, Object>> conflict(DataIntegrityViolationException ex, HttpServletRequest request) {
        Throwable cause = NestedExceptionUtils.getMostSpecificCause(ex);
        log.warn("Database constraint rejected request causeType={}", cause.getClass().getSimpleName());
        if (cause instanceof SQLException sql && "23514".equals(sql.getSQLState())) {
            return error(HttpStatus.BAD_REQUEST, "DATABASE_CONSTRAINT_VIOLATION", Map.of(), request);
        }
        return error(HttpStatus.CONFLICT, "DATA_CONFLICT", Map.of(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        log.warn("Request validation failed fieldErrorCount={}", ex.getBindingResult().getFieldErrorCount());
        List<Map<String, String>> fields = ex.getBindingResult().getFieldErrors().stream()
                .map(field -> Map.of("field", field.getField(), "reason", "INVALID"))
                .distinct().toList();
        ResponseEntity<Map<String, Object>> response = error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", Map.of(), request);
        response.getBody().put("fields", fields);
        return response;
    }

    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class, ConstraintViolationException.class})
    ResponseEntity<Map<String, Object>> invalid(Exception ex, HttpServletRequest request) {
        log.warn("Invalid request exception={}", ex.getClass().getSimpleName());
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", Map.of(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, Object>> denied(AccessDeniedException ex, HttpServletRequest request) {
        log.warn("Access denied");
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", Map.of(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unexpected(Exception ex, HttpServletRequest request) {
        log.error("Unexpected request failure", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", Map.of(), request);
    }
}
