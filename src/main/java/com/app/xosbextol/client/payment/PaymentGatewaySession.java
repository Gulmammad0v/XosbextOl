package com.app.xosbextol.client.payment;
import lombok.*;
import lombok.experimental.Accessors;
@Data @NoArgsConstructor @AllArgsConstructor @Accessors(fluent=true)
public class PaymentGatewaySession { private String transactionId; private String checkoutUrl; }
