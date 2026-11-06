package com.app.xosbextol.model.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class MenuCategoryResponseDto {
    private long id;
    private String name;
    private int sortOrder;
    private Boolean defaultCustomizable;
    private BigDecimal defaultPricePerPerson;
    private List<MenuItemResponseDto> items;
}
