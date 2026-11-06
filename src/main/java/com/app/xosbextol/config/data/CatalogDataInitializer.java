package com.app.xosbextol.config.data;

import com.app.xosbextol.model.entity.Amenity;
import com.app.xosbextol.model.entity.MenuItemTemplate;
import com.app.xosbextol.repository.AmenityRepository;
import com.app.xosbextol.repository.MenuItemTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.List;

@Component
@Order(-390)
@RequiredArgsConstructor
@Log4j2
public class CatalogDataInitializer implements ApplicationRunner {
    private static final List<AmenitySeed> AMENITIES = List.of(
            new AmenitySeed("PARKING", "Parkinq", "Парковка", "Parking"),
            new AmenitySeed("STAGE", "Səhnə", "Сцена", "Stage"),
            new AmenitySeed("KITCHEN", "Mətbəx", "Кухня", "Kitchen"),
            new AmenitySeed("AC", "Kondisioner", "Кондиционер", "Air conditioning"),
            new AmenitySeed("SOUND", "Səs sistemi", "Звуковая система", "Sound system"),
            new AmenitySeed("DECOR", "Bəzək xidməti", "Декор", "Decoration"),
            new AmenitySeed("BRIDAL_ROOM", "Gəlin otağı", "Комната невесты", "Bridal room"),
            new AmenitySeed("WIFI", "Wi-Fi", "Wi-Fi", "Wi-Fi"));

    private final AmenityRepository amenities;
    private final MenuItemTemplateRepository menuItems;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        seedAmenities();
        seedMenuTemplates();
        log.info("Hibernate catalog data initialized");
    }

    private void seedAmenities() {
        for (AmenitySeed seed : AMENITIES) {
            amenities.findByCode(seed.code()).orElseGet(() -> amenities.save(
                    new Amenity(seed.code(), seed.nameAz(), seed.nameRu(), seed.nameEn())));
        }
    }

    private void seedMenuTemplates() throws IOException {
        var resource = new ClassPathResource("catalog/menu-items.json");
        List<MenuTemplateSeed> seeds;
        try (var input = resource.getInputStream()) {
            seeds = objectMapper.readValue(input, new TypeReference<>() {});
        }
        for (MenuTemplateSeed seed : seeds) {
            MenuItemTemplate item = menuItems
                    .findByCategoryNameIgnoreCaseAndItemNameIgnoreCase(seed.categoryName(), seed.itemName())
                    .orElseGet(MenuItemTemplate::new);
            item.setCategoryName(seed.categoryName());
            item.setCategorySortOrder(seed.categorySortOrder());
            item.setItemName(seed.itemName());
            item.setItemSortOrder(seed.itemSortOrder());
            item.setSeasonal(seed.seasonal());
            item.setActive(true);
            menuItems.save(item);
        }
    }

    private record AmenitySeed(String code, String nameAz, String nameRu, String nameEn) {}

    private record MenuTemplateSeed(String categoryName, int categorySortOrder, String itemName,
                                    int itemSortOrder, boolean seasonal) {}
}
