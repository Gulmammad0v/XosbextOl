package com.app.xosbextol.model.dto;

import lombok.*;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class VenueDetailResponseDto {
    private VenueItemResponseDto venue;
    private String description;
    private List<HallResponseDto> halls;
    private List<VenueMediaResponseDto> media;
    private List<AmenityResponseDto> amenities;
    private List<ExtraServiceResponseDto> services;
    private List<MenuPackageResponseDto> menus;
}
