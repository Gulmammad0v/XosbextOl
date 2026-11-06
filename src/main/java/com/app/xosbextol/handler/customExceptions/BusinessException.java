package com.app.xosbextol.handler.customExceptions;

import org.springframework.http.HttpStatus;

public class BusinessException extends ApiException {

    public BusinessException(HttpStatus status, String message) {
        super(status, message != null && message.matches("[A-Z][A-Z0-9_]+") ? message : codeFor(status));
    }

    public static BusinessException missing(String type) {
        return new BusinessException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND");
    }

    public static BusinessException conflict(String message) {
        return new BusinessException(HttpStatus.CONFLICT, message);
    }

    public static BusinessException forbidden() {
        return new BusinessException(HttpStatus.FORBIDDEN, "FORBIDDEN");
    }

    public static BusinessException invalid(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST");
    }

    private static String codeFor(HttpStatus status) {
        return switch (status) {
            case NOT_FOUND -> "RESOURCE_NOT_FOUND";
            case FORBIDDEN -> "FORBIDDEN";
            case BAD_REQUEST -> "INVALID_REQUEST";
            case UNAUTHORIZED -> "AUTH_INVALID_TOKEN";
            case TOO_MANY_REQUESTS -> "RATE_LIMIT_EXCEEDED";
            case SERVICE_UNAVAILABLE -> "EMAIL_DELIVERY_FAILED";
            default -> "BUSINESS_CONFLICT";
        };
    }
}
