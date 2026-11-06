package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class MenuCategoryRequestDto {
    @NotBlank @Size(max = 120) String name;
    @NotNull @Min(1) @Max(100) Integer sortOrder;
    Boolean defaultCustomizable;
    @DecimalMin("1") @Digits(integer = 10, fraction = 2) BigDecimal defaultPricePerPerson;
    @NotEmpty @Size(max = 100) List<@Valid MenuItemRequestDto> items;

    public MenuCategoryRequestDto(String name, Integer sortOrder, List<MenuItemRequestDto> items) {
            this(name, sortOrder, null, null, items);
        }
}
