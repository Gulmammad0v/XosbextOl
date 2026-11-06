package com.app.xosbextol.model.dto;

import com.app.xosbextol.model.enums.VenueStatus;
import lombok.*;
import java.math.BigDecimal;

@Data @NoArgsConstructor @AllArgsConstructor
public class VenueItemResponseDto {
    private long id;
    private String name;
    private String slug;
    private String address;
    private String city;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String coverImageUrl;
    private BigDecimal rating;
    private int reviewCount;
    private Integer capacityMin;
    private Integer capacityMax;
    private BigDecimal minPricePerPerson;
    private VenueStatus status;
    private String changeReviewStatus;
    private String companyEditStatus;
}
