package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.*;
import lombok.*;
import java.math.BigDecimal;

@Data @NoArgsConstructor @AllArgsConstructor
public class HallRequestDto {
    @NotBlank @Size(max = 150) private String name;
    @Min(1) private int capacityMin;
    @Min(1) private int capacityMax;
    @DecimalMin("0") @Digits(integer = 10, fraction = 2) private BigDecimal pricePerPerson;
    @NotNull @DecimalMin("1") @DecimalMax("100") @Digits(integer = 3, fraction = 2) private BigDecimal depositPercent;
    private boolean active;
}
