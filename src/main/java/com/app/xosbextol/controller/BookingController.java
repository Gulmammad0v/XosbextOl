package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.JpaBookingService;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.model.dto.PageResponse;
import com.app.xosbextol.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {
    private final JpaBookingService service;

    @GetMapping
    PageResponse<BookingResponseDto> mine(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.mine(CurrentUser.id(), page, size);
    }

    @GetMapping("/{id}")
    BookingResponseDto detail(@PathVariable long id) {
        return service.detail(CurrentUser.id(), id);
    }

    @PostMapping("/{id}/cancel")
    BookingResponseDto cancel(@PathVariable long id, @Valid @RequestBody CancelBookingRequestDto req) {
        return service.cancel(CurrentUser.id(), id, req);
    }
}
