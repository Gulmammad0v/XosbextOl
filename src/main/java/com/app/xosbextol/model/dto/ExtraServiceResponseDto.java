package com.app.xosbextol.model.dto;

import lombok.*;
import java.math.BigDecimal;

@Data @NoArgsConstructor @AllArgsConstructor
public class ExtraServiceResponseDto {
    private long id;
    private String name;
    private String description;
    private BigDecimal price;
    private String priceType;
    private boolean active;
}
