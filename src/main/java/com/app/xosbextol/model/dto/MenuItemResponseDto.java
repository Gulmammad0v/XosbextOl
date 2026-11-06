package com.app.xosbextol.model.dto;

import lombok.*;
import java.math.BigDecimal;

@Data @NoArgsConstructor @AllArgsConstructor
public class MenuItemResponseDto {
    private long id;
    private String name;
    private String description;
    private boolean seasonal;
    private boolean customizable;
    private BigDecimal additionalPricePerPerson;
}
