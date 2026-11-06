package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import com.app.xosbextol.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class StandardVenueCatalogService {
    private final MenuItemTemplateRepository templates;
    private final VenueMenuPackageRepository packages;
    private final VenueMenuCategoryRepository categories;
    private final VenueMenuItemRepository items;
    private final VenueMenuPackageItemRepository packageItems;
    private final ExtraServiceRepository services;

    public void ensureForVenue(Venue venue) {
        if (!packages.existsByVenue_IdAndActiveTrue(venue.getId())) copyStandardMenu(venue);
        for (String name : List.of("Musiqi", "Video çəkilişi", "Zər yağışı")) {
            if (services.existsByVenue_IdAndNameIgnoreCase(venue.getId(), name)) continue;
            ExtraService service = new ExtraService();
            service.setVenue(venue);
            service.setName(name);
            service.setDescription("Standart servis seçimi");
            service.setPrice(BigDecimal.ZERO);
            service.setPriceType("FIXED");
            service.setActive(false);
            services.save(service);
        }
    }

    private void copyStandardMenu(Venue venue) {
        List<MenuItemTemplate> source = templates.findByActiveTrueOrderByCategorySortOrderAscItemSortOrderAsc();
        if (source.isEmpty()) return;
        VenueMenuPackage menu = packages.findByVenue_IdAndNameIgnoreCase(venue.getId(), "Standart toy menyusu")
                .orElseGet(VenueMenuPackage::new);
        menu.setVenue(venue);
        menu.setName("Standart toy menyusu");
        menu.setDescription("Platformanın standart toy menyusu şablonu");
        menu.setPricePerPerson(BigDecimal.ZERO);
        menu.setTier(1);
        menu.setPopular(false);
        menu.setActive(true);
        menu = packages.save(menu);

        List<VenueMenuPackageItem> existingLines = packageItems.findByMenuPackage_Id(menu.getId());
        packageItems.deleteAll(existingLines);
        packageItems.flush();

        Map<String, VenueMenuCategory> categoryMap = new LinkedHashMap<>();
        for (MenuItemTemplate template : source) {
            VenueMenuCategory category = categoryMap.computeIfAbsent(template.getCategoryName(), name -> {
                VenueMenuCategory value = categories.findByVenue_IdAndNameIgnoreCase(venue.getId(), name).orElseGet(VenueMenuCategory::new);
                value.setVenue(venue);
                value.setName(name);
                value.setSortOrder(template.getCategorySortOrder());
                return categories.save(value);
            });
            VenueMenuItem item = items.findByCategory_IdAndNameIgnoreCase(category.getId(), template.getItemName()).orElseGet(VenueMenuItem::new);
            item.setCategory(category);
            item.setName(template.getItemName());
            item.setDescription(null);
            item.setSeasonal(Boolean.TRUE.equals(template.getSeasonal()));
            item.setCustomizable(false);
            item.setAdditionalPricePerPerson(BigDecimal.ZERO);
            item.setActive(true);
            item = items.save(item);
            VenueMenuPackageItem line = new VenueMenuPackageItem();
            line.setMenuPackage(menu);
            line.setMenuItem(item);
            packageItems.save(line);
        }
    }
}
