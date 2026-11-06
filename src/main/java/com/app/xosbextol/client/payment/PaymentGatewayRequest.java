package com.app.xosbextol.client.payment;
import lombok.*;
import lombok.experimental.Accessors;
import java.math.BigDecimal;
@Data @NoArgsConstructor @AllArgsConstructor @Accessors(fluent=true)
public class PaymentGatewayRequest { private long paymentId; private Long bookingId; private BigDecimal amount; private String currency; private String idempotencyKey; }
