package com.app.xosbextol.model.dto;

import jakarta.validation.constraints.*;
import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class VenueMediaRequestDto {
    private Long hallId;
    @NotNull @Pattern(regexp = "IMAGE|VIDEO") private String type;
    @NotBlank @Pattern(regexp = "https://.+") @Size(max = 500) private String url;
    @Pattern(regexp = "https://.+") @Size(max = 500) private String thumbUrl;
    @Min(0) private int sortOrder;
}
