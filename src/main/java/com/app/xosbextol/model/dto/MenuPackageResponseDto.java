package com.app.xosbextol.model.dto;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class MenuPackageResponseDto {
    private long id;
    private String name;
    private String description;
    private BigDecimal pricePerPerson;
    private boolean popular;
    private int tier;
    private List<MenuCategoryResponseDto> categories;
}
