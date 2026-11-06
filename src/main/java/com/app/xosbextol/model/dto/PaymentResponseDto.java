package com.app.xosbextol.model.dto;
import lombok.Value;
import java.math.BigDecimal;
@Value
public class PaymentResponseDto {
    long id; Long bookingId; String provider; String transactionId; String checkoutUrl;
    BigDecimal amount; String currency; String status;
    public long id() { return id; }
    public String transactionId() { return transactionId; }
    public String checkoutUrl() { return checkoutUrl; }
    public BigDecimal amount() { return amount; }
    public String status() { return status; }
}
