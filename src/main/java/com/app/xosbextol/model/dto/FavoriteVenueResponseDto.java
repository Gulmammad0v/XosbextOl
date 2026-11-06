package com.app.xosbextol.model.dto;

import lombok.Value;

import java.math.BigDecimal;

@Value
public class FavoriteVenueResponseDto {
    long id;
    String name;
    String slug;
    String address;
    String coverImageUrl;
    BigDecimal rating;
    int reviewCount;
}
