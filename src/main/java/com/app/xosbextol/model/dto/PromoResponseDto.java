package com.app.xosbextol.model.dto;

import lombok.Value;
import java.math.BigDecimal;
import java.time.Instant;

@Value
public class PromoResponseDto {
    long id;
    String code;
    String discountType;
    BigDecimal discountValue;
    Integer maxUses;
    int usedCount;
    Instant validFrom;
    Instant validTo;
    boolean active;
}
