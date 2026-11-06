package com.app.xosbextol.util;

import io.github.resilience4j.circuitbreaker.*;
import io.github.resilience4j.retry.*;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.client.*;

import java.time.Duration;
import java.util.function.Supplier;

@Log4j2
public final class ExternalCall {
    private final CircuitBreaker breaker;
    private final Retry retry;

    public ExternalCall(String name) {
        var retryConfig = RetryConfig.custom().maxAttempts(2).waitDuration(Duration.ofMillis(150))
                .retryOnException(ex -> ex instanceof ResourceAccessException || ex instanceof HttpServerErrorException).build();
        retry = Retry.of(name, retryConfig);
        breaker = CircuitBreaker.of(name, CircuitBreakerConfig.custom().slidingWindowSize(20).minimumNumberOfCalls(10)
                .failureRateThreshold(50).waitDurationInOpenState(Duration.ofSeconds(30))
                .recordException(ex -> ex instanceof ResourceAccessException || ex instanceof HttpServerErrorException).build());
        retry.getEventPublisher().onRetry(event -> log.warn(
                "External call retry name={} attempt={} failureType={}", name,
                event.getNumberOfRetryAttempts(), event.getLastThrowable().getClass().getSimpleName()));
        breaker.getEventPublisher().onStateTransition(event -> log.warn(
                "External circuit breaker transitioned name={} transition={}", name, event.getStateTransition()));
    }

    public <T> T execute(Supplier<T> call) {
        return CircuitBreaker.decorateSupplier(breaker, Retry.decorateSupplier(retry, call)).get();
    }
}
