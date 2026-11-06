package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.*;
import lombok.*;
import java.math.BigDecimal;
@Data @NoArgsConstructor @AllArgsConstructor
public class PaymentWebhookRequestDto {
    @NotBlank @Size(max=30) private String provider;
    @NotBlank @Size(max=100) private String transactionId;
    @NotBlank @Pattern(regexp="SUCCESS|FAILED|CANCELLED|PENDING") private String status;
    @NotNull @DecimalMin("0.01") private BigDecimal amount;
    @NotBlank @Pattern(regexp="[A-Z]{3}") private String currency;
}
