package com.app.xosbextol.client.payment;

import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.beans.factory.annotation.Value;

import java.util.concurrent.ConcurrentHashMap;
import java.math.BigDecimal;

@Component
@Profile({"dev", "test"})
public class StubPaymentGateway implements PaymentGateway {
    private final ConcurrentHashMap<String, PaymentGatewayResult> states = new ConcurrentHashMap<>();
    private final String returnUrl;
    private final boolean autoSuccess;

    public StubPaymentGateway(@Value("${app.payment.return-url}") String returnUrl,
                              @Value("${app.payment.stub-auto-success:false}") boolean autoSuccess) {
        this.returnUrl = returnUrl;
        this.autoSuccess = autoSuccess;
    }

    public String provider() {
        return "stub";
    }

    public PaymentGatewaySession initiate(PaymentGatewayRequest req) {
        String tx = "stub-" + req.idempotencyKey();
        String status = autoSuccess ? "SUCCESS" : "PENDING";
        states.putIfAbsent(tx, new PaymentGatewayResult(tx, status, req.amount(), req.currency()));
        return new PaymentGatewaySession(tx, returnUrl + "?stub_tx=" + tx);
    }

    public PaymentGatewayResult status(String tx) {
        return states.getOrDefault(tx, new PaymentGatewayResult(tx, "UNKNOWN", BigDecimal.ZERO, "AZN"));
    }

    public PaymentGatewayResult cancel(String tx) {
        return states.computeIfPresent(tx, (k, r) -> "PENDING".equals(r.status()) ? new PaymentGatewayResult(tx, "CANCELLED", r.amount(), r.currency()) : r);
    }

    public String refund(String tx, BigDecimal amount, String key) {
        return "stub-refund-" + key;
    }
}
