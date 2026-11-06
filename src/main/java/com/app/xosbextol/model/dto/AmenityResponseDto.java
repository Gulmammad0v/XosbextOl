package com.app.xosbextol.model.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class AmenityResponseDto {
    private short id;
    private String code;
    private String nameAz;
    private String nameRu;
    private String nameEn;
    private String icon;
}
