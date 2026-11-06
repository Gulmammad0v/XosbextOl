package com.app.xosbextol.client.payment;
import lombok.*;
import lombok.experimental.Accessors;
import java.math.BigDecimal;
@Data @NoArgsConstructor @AllArgsConstructor @Accessors(fluent=true)
public class PaymentGatewayResult { private String transactionId; private String status; private BigDecimal amount; private String currency; }
