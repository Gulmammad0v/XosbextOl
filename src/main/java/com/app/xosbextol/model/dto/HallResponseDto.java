package com.app.xosbextol.model.dto;

import lombok.*;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HallResponseDto {
    private long id;
    private String name;
    private int capacityMin;
    private int capacityMax;
    private BigDecimal pricePerPerson;
    private BigDecimal depositPercent;
    private boolean active;
}
