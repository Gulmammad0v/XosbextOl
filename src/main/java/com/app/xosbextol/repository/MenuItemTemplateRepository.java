package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.MenuItemTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface MenuItemTemplateRepository extends JpaRepository<MenuItemTemplate, Long> {
    List<MenuItemTemplate> findByActiveTrueOrderByCategorySortOrderAscItemSortOrderAsc();
    Optional<MenuItemTemplate> findByCategoryNameIgnoreCaseAndItemNameIgnoreCase(String categoryName, String itemName);
}
