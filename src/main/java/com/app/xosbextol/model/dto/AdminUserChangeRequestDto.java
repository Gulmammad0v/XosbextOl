package com.app.xosbextol.model.dto;
import jakarta.validation.constraints.Pattern;
import lombok.*;
@Data @NoArgsConstructor @AllArgsConstructor
public class AdminUserChangeRequestDto {
    @Pattern(regexp="CUSTOMER|VENUE_OWNER|ADMIN") private String role;
    @Pattern(regexp="ACTIVE|BLOCKED|DELETED") private String status;
}
