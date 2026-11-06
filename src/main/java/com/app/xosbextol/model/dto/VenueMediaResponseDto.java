package com.app.xosbextol.model.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class VenueMediaResponseDto {
    private long id;
    private Long hallId;
    private String type;
    private String url;
    private String thumbUrl;
    private int sortOrder;
}
