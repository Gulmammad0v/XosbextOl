package com.app.xosbextol.service.impl;

import com.app.xosbextol.repository.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class StatsServiceTest {
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final RefundRepository refunds = mock(RefundRepository.class);
    private final StatsService service = new StatsService(
            mock(UserRepository.class), mock(VenueRepository.class), mock(BookingRepository.class),
            payments, refunds, mock(AuditLogRepository.class), mock(HallRepository.class),
            mock(PromoCodeRepository.class), mock(ReviewRepository.class),
            mock(VenueMenuPackageRepository.class), mock(ExtraServiceRepository.class),
            mock(VenueMediaRepository.class));

    @Test
    void calculatesMonthlyRevenueAndIncludesVenuesWithOnlyRefunds() {
        Instant from = Instant.parse("2026-09-30T20:00:00Z");
        Instant to = Instant.parse("2026-10-31T20:00:00Z");
        when(payments.revenueByVenue(from, to)).thenReturn(List.<Object[]>of(
                new Object[]{10L, "Alinea", 3L, new BigDecimal("900.00")}));
        when(refunds.processedByVenue(from, to)).thenReturn(List.<Object[]>of(
                new Object[]{10L, "Alinea", new BigDecimal("100.00")},
                new Object[]{20L, "Buta", new BigDecimal("40.00")}));

        Map<String, Object> result = service.monthlyRevenue(YearMonth.of(2026, 10));

        assertEquals("2026-10", result.get("month"));
        assertEquals(new BigDecimal("900.00"), result.get("collected"));
        assertEquals(new BigDecimal("140.00"), result.get("refunded"));
        assertEquals(new BigDecimal("760.00"), result.get("net"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> venues = (List<Map<String, Object>>) result.get("venues");
        assertEquals(List.of("Alinea", "Buta"), venues.stream().map(row -> row.get("venueName")).toList());
        assertEquals(new BigDecimal("800.00"), venues.getFirst().get("net"));
        assertEquals(new BigDecimal("-40.00"), venues.get(1).get("net"));
    }
}
