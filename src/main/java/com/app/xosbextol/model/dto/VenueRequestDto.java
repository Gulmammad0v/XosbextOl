package com.app.xosbextol.model.dto;

import com.app.xosbextol.model.constant.AzerbaijanCities;
import jakarta.validation.constraints.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class VenueRequestDto {
    @NotBlank @Size(max = 200) private String name;
    @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") @Size(max = 220) private String slug;
    @Size(max = 10000) private String description;
    @NotBlank @Size(max = 500) private String address;
    @NotBlank @Pattern(regexp = AzerbaijanCities.PATTERN, message = "Dəstəklənən şəhərlərdən birini seçin") @Size(max = 80) private String city;
    @NotNull @DecimalMin("-90") @DecimalMax("90") private BigDecimal latitude;
    @NotNull @DecimalMin("-180") @DecimalMax("180") private BigDecimal longitude;
    @Size(max = 100) private List<Short> amenityIds;
    @Size(max = 50) private List<@NotBlank @Size(max = 100) String> customAmenityNames;

    public VenueRequestDto(String name, String slug, String description, String address, String city,
            BigDecimal latitude, BigDecimal longitude) {
        this(name, slug, description, address, city, latitude, longitude, null, null);
    }
}
