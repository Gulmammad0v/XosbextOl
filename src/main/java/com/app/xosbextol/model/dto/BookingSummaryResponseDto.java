package com.app.xosbextol.model.dto;

import lombok.*;
import java.math.BigDecimal;

@Data @NoArgsConstructor @AllArgsConstructor
public class BookingSummaryResponseDto {
    private long totalBookings;
    private long confirmedBookings;
    private BigDecimal bookedValue;
    private BigDecimal collected;
}
