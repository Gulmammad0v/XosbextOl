package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import java.math.BigDecimal;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class BookingExtraServiceResponseDto {
    long serviceId;
    String name;
    int quantity;
    BigDecimal unitPrice;
    BigDecimal totalPrice;
}
