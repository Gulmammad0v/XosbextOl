package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.JpaBookingService;
import com.app.xosbextol.model.dto.BookingResponseDto;
import com.app.xosbextol.model.dto.PageResponse;
import com.app.xosbextol.model.dto.RejectBookingRequestDto;
import com.app.xosbextol.model.enums.BookingStatus;
import com.app.xosbextol.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;

@RestController
@RequiredArgsConstructor
public class PartnerBookingController {
    private final JpaBookingService service;

    @GetMapping("/api/partner/venues/{id}/report")
    Object report(@PathVariable long id,
                  @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        return service.report(CurrentUser.id(), id, month);
    }

    @GetMapping("/api/partner/venues/{id}/bookings")
    PageResponse<BookingResponseDto> list(@PathVariable long id,
                                          @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM") YearMonth month,
                                          @RequestParam(required = false) Long hallId,
                                          @RequestParam(required = false) Long menuPackageId,
                                          @RequestParam(required = false) BookingStatus status,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        return service.partner(CurrentUser.id(), id, month, hallId, menuPackageId, status, page, size);
    }

    @GetMapping("/api/partner/bookings/pending")
    PageResponse<BookingResponseDto> pending(@RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return service.partnerPending(CurrentUser.id(), page, size);
    }

    @GetMapping("/api/partner/bookings/{id}")
    BookingResponseDto detail(@PathVariable long id) {
        return service.partnerDetail(CurrentUser.id(), id);
    }

    @PostMapping("/api/partner/bookings/{id}/approve")
    BookingResponseDto approve(@PathVariable long id) {
        return service.approve(CurrentUser.id(), id);
    }

    @PostMapping("/api/partner/bookings/{id}/reject")
    BookingResponseDto reject(@PathVariable long id, @Valid @RequestBody RejectBookingRequestDto request) {
        return service.reject(CurrentUser.id(), id, request);
    }

    @PostMapping("/api/partner/bookings/{id}/complete")
    BookingResponseDto complete(@PathVariable long id) {
        return service.complete(CurrentUser.id(), id);
    }

}
