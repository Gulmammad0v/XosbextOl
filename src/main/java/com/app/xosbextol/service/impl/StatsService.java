package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.dto.AuditLogResponseDto;
import com.app.xosbextol.model.dto.PageResponse;
import com.app.xosbextol.repository.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

import java.util.Map;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.LinkedHashMap;

@Service
@RequiredArgsConstructor
public class StatsService {
    private final UserRepository users;
    private final VenueRepository venues;
    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final RefundRepository refunds;
    private final AuditLogRepository audits;
    private final HallRepository halls;
    private final PromoCodeRepository promos;
    private final ReviewRepository reviews;
    private final VenueMenuPackageRepository menuPackages;
    private final ExtraServiceRepository extraServices;
    private final VenueMediaRepository venueMedia;

    public Map<String, Object> dashboard() {
        var paymentTotals = payments.totals().getFirst();
        return Map.of("users", users.count(), "venues", counts(venues.countByStatus()), "bookings", counts(bookings.countByStatus()),
                "payments", Map.of("collected", paymentTotals[0], "refunded", paymentTotals[1]), "pendingRefunds", refunds.countByStatus("REQUESTED"));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> monthlyRevenue(YearMonth requestedMonth) {
        ZoneId zone = ZoneId.of("Asia/Baku");
        YearMonth month = requestedMonth == null ? YearMonth.now(zone) : requestedMonth;
        var from = month.atDay(1).atStartOfDay(zone).toInstant();
        var to = month.plusMonths(1).atDay(1).atStartOfDay(zone).toInstant();

        var rows = new LinkedHashMap<Long, RevenueRow>();
        payments.revenueByVenue(from, to).forEach(value -> {
            long venueId = number(value[0]).longValue();
            rows.put(venueId, new RevenueRow(venueId, value[1].toString(), number(value[2]).longValue(),
                    decimal(value[3]), BigDecimal.ZERO));
        });
        refunds.processedByVenue(from, to).forEach(value -> {
            long venueId = number(value[0]).longValue();
            RevenueRow current = rows.getOrDefault(venueId,
                    new RevenueRow(venueId, value[1].toString(), 0, BigDecimal.ZERO, BigDecimal.ZERO));
            rows.put(venueId, new RevenueRow(current.venueId(), current.venueName(), current.bookingCount(),
                    current.collected(), decimal(value[2])));
        });

        var venues = rows.values().stream()
                .sorted(java.util.Comparator.comparing(RevenueRow::net).reversed())
                .map(RevenueRow::map)
                .toList();
        BigDecimal collected = rows.values().stream().map(RevenueRow::collected).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = rows.values().stream().map(RevenueRow::refunded).reduce(BigDecimal.ZERO, BigDecimal::add);
        return Map.of("month", month.toString(), "collected", collected, "refunded", refunded,
                "net", collected.subtract(refunded), "venues", venues);
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponseDto> audit(int page, int size, java.time.LocalDate fromDate, java.time.LocalDate toDate) {
        if (page < 0 || size < 1 || size > 100)
            throw com.app.xosbextol.handler.customExceptions.BusinessException.invalid("Səhifə ölçüsü 1–100 olmalıdır");
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate))
            throw com.app.xosbextol.handler.customExceptions.BusinessException.invalid("Başlanğıc tarixi bitmə tarixindən sonra ola bilməz");
        var zone = java.time.ZoneId.of("Asia/Baku");
        var from = fromDate == null ? java.time.Instant.EPOCH : fromDate.atStartOfDay(zone).toInstant();
        var to = toDate == null ? java.time.Instant.parse("9999-12-31T23:59:59Z") : toDate.plusDays(1).atStartOfDay(zone).toInstant();
        return PageResponse.from(audits.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(from, to,
                        PageRequest.of(page, size, Sort.by("id").descending()))
                .map(a -> new AuditLogResponseDto(a.getId(), a.getActor() == null ? null : a.getActor().getId(),
                        actorName(a), a.getAction(), a.getEntityType(), a.getEntityId(),
                        entityName(a.getEntityType(), a.getEntityId()), a.getCreatedAt())));
    }

    private String actorName(com.app.xosbextol.model.entity.AuditLog audit) {
        if (audit.getActor() == null) return "Sistem";
        String name = audit.getActor().getFullName();
        return name == null || name.isBlank() ? audit.getActor().getEmail() : name;
    }

    private String entityName(String type, Long id) {
        if (id == null) return "—";
        return switch (type) {
            case "USER" -> users.findById(id).map(u -> u.getFullName() == null || u.getFullName().isBlank() ? u.getEmail() : u.getFullName()).orElse("İstifadəçi");
            case "VENUE" -> venues.findById(id).map(com.app.xosbextol.model.entity.Venue::getName).orElse("Məkan");
            case "BOOKING" -> bookings.findById(id).map(com.app.xosbextol.model.entity.Booking::getBookingNumber).orElse("Rezervasiya");
            case "HALL" -> halls.findById(id).map(com.app.xosbextol.model.entity.VenueHall::getName).orElse("Zal");
            case "PROMO" -> promos.findById(id).map(com.app.xosbextol.model.entity.PromoCode::getCode).orElse("Promo kod");
            case "REVIEW" -> reviews.findById(id).map(r -> r.getVenue().getName() + " rəyi").orElse("Rəy");
            case "MENU_PACKAGE" -> menuPackages.findById(id).map(com.app.xosbextol.model.entity.VenueMenuPackage::getName).orElse("Menyu");
            case "EXTRA_SERVICE" -> extraServices.findById(id).map(com.app.xosbextol.model.entity.ExtraService::getName).orElse("Əlavə xidmət");
            case "VENUE_MEDIA" -> venueMedia.findById(id).map(m -> m.getVenue().getName() + " mediası").orElse("Media");
            case "PAYMENT" -> payments.findById(id).map(p -> p.getBooking().getBookingNumber() + " ödənişi").orElse("Ödəniş");
            case "REFUND" -> refunds.findById(id).map(r -> r.getBooking().getBookingNumber() + " geri ödənişi").orElse("Geri ödəniş");
            default -> type;
        };
    }

    private java.util.List<java.util.Map<String, Object>> counts(java.util.List<Object[]> rows) {
        return rows.stream().map(r -> java.util.Map.<String, Object>of("status", r[0].toString(), "count", r[1])).toList();
    }

    private Number number(Object value) {
        return value instanceof Number number ? number : 0;
    }

    private BigDecimal decimal(Object value) {
        return value instanceof BigDecimal decimal ? decimal : value == null ? BigDecimal.ZERO : new BigDecimal(value.toString());
    }

    @lombok.Value
    @lombok.Builder
    @lombok.extern.jackson.Jacksonized
    @lombok.experimental.Accessors(fluent = true)
    private static class RevenueRow {
        long venueId;
        String venueName;
        long bookingCount;
        BigDecimal collected;
        BigDecimal refunded;

        BigDecimal net() { return collected.subtract(refunded); }
                Map<String, Object> map() {
                    return Map.of("venueId", venueId, "venueName", venueName, "bookingCount", bookingCount,
                            "collected", collected, "refunded", refunded, "net", net());
                }
    }
}
