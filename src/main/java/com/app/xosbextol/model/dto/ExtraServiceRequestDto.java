package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.*;
import lombok.*;
import java.math.BigDecimal;

@Data @NoArgsConstructor @AllArgsConstructor
public class ExtraServiceRequestDto {
    @NotBlank @Size(max = 150) private String name;
    @Size(max = 500) private String description;
    @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) private BigDecimal price;
    @NotNull @Pattern(regexp = "FIXED|PER_PERSON") private String priceType;
    private boolean active;
}
