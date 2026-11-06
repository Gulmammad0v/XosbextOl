package com.app.xosbextol.handler.customExceptions;

import org.springframework.http.HttpStatus;

import java.util.Map;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Map<String, Object> params;

    public ApiException(HttpStatus status, String code) {
        this(status, code, Map.of());
    }

    public ApiException(HttpStatus status, String code, Map<String, ?> params) {
        super(code);
        this.status = status;
        this.code = code;
        this.params = Map.copyOf(params);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public Map<String, Object> params() {
        return params;
    }
}
