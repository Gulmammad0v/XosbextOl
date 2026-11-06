package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "menu_item_templates", uniqueConstraints = @UniqueConstraint(columnNames = {"category_name", "item_name"}))
@Getter @Setter @NoArgsConstructor
public class MenuItemTemplate extends BaseEntity {
    @Column(name = "category_name", nullable = false, length = 120)
    private String categoryName;
    @Column(nullable = false)
    private Integer categorySortOrder;
    @Column(name = "item_name", nullable = false, length = 160)
    private String itemName;
    @Column(nullable = false)
    private Integer itemSortOrder;
    private Boolean seasonal = false;
    private Boolean active = true;
}
