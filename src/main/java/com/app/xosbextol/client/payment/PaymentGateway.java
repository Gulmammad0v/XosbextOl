package com.app.xosbextol.client.payment;

import java.math.BigDecimal;
public interface PaymentGateway {
    String provider();

    PaymentGatewaySession initiate(PaymentGatewayRequest request);

    PaymentGatewayResult status(String transactionId);

    // Provider must atomically prevent subsequent settlement or report an already successful payment.
    PaymentGatewayResult cancel(String transactionId);

    String refund(String transactionId, BigDecimal amount, String idempotencyKey);
}
