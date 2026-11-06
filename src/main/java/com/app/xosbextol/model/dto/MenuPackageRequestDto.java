package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import jakarta.validation.constraints.*;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class MenuPackageRequestDto {
    @NotBlank @Size(max = 120) String name;
    @Size(max = 500) String description;
    @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal pricePerPerson;
    @NotNull @Min(1) @Max(100) Integer tier;
    boolean popular;
    boolean active;
    @Size(min = 1, max = 20) List<@Valid MenuCategoryRequestDto> categories;

    public MenuPackageRequestDto(String name, String description, BigDecimal pricePerPerson,
                                     Integer tier, boolean popular, boolean active) {
            this(name, description, pricePerPerson, tier, popular, active, null);
        }
}
