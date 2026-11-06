package com.app.xosbextol.model.dto;

import lombok.*;
import java.math.BigDecimal;

@Data @NoArgsConstructor @AllArgsConstructor
public class BookingMenuChangeResponseDto {
    private long itemId;
    private String name;
    private String categoryName;
    private String action;
    private BigDecimal pricePerPerson;
}
