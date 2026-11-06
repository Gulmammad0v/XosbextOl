package com.app.xosbextol.client.payment;

import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.JdkClientHttpRequestFactory;

import java.net.http.HttpClient;
import java.time.Duration;
import java.math.BigDecimal;
import java.util.Map;

@Component
@Profile("!dev & !test")
public class HttpPaymentGateway implements PaymentGateway {
    private final RestClient client;
    private final String provider;
    private final com.app.xosbextol.util.ExternalCall external = new com.app.xosbextol.util.ExternalCall("payment");

    public HttpPaymentGateway(@Value("${app.payment.base-url}") String url, @Value("${app.payment.api-key}") String key,
                              @Value("${app.payment.provider}") String provider) {
        if (url.isBlank() || key.isBlank())
            throw new IllegalArgumentException("PAYMENT_BASE_URL and PAYMENT_API_KEY are required");
        this.provider = provider;
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        client = RestClient.builder().baseUrl(url).defaultHeader("Authorization", "Bearer " + key).requestFactory(factory).build();
    }

    public String provider() {
        return provider;
    }

    public PaymentGatewaySession initiate(PaymentGatewayRequest req) {
        return external.execute(() -> client.post().uri("/sessions").header("Idempotency-Key", req.idempotencyKey()).body(req).retrieve().body(PaymentGatewaySession.class));
    }

    public PaymentGatewayResult status(String tx) {
        return external.execute(() -> client.get().uri("/transactions/{id}", tx).retrieve().body(PaymentGatewayResult.class));
    }

    public PaymentGatewayResult cancel(String tx) {
        return external.execute(() -> client.post().uri("/transactions/{id}/cancel", tx).retrieve().body(PaymentGatewayResult.class));
    }

    public String refund(String tx, BigDecimal amount, String key) {
        var result = external.execute(() -> client.post().uri("/transactions/{id}/refund", tx).header("Idempotency-Key", key)
                .body(Map.of("amount", amount)).retrieve().body(PaymentGatewaySession.class));
        if (result == null || result.transactionId() == null)
            throw new IllegalStateException("Invalid refund response");
        return result.transactionId();
    }
}
