package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class MenuItemTemplateResponseDto {
    long id;
    String categoryName;
    int categorySortOrder;
    String itemName;
    int itemSortOrder;
    boolean seasonal;
}
