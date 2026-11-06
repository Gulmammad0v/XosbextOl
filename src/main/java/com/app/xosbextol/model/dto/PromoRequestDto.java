package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data @NoArgsConstructor @AllArgsConstructor
public class PromoRequestDto {
    @NotBlank @Pattern(regexp = "[A-Z0-9_-]{1,40}") private String code;
    @NotNull @Pattern(regexp = "PERCENT|FIXED") private String discountType;
    @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) private BigDecimal discountValue;
    @Min(1) private Integer maxUses;
    private Instant validFrom;
    private Instant validTo;
    private boolean active;
}
