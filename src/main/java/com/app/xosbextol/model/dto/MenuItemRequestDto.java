package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class MenuItemRequestDto {
    @NotBlank @Size(max = 160) String name;
    @Size(max = 500) String description;
    boolean seasonal;
    boolean customizable;
    @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal additionalPricePerPerson;
}
