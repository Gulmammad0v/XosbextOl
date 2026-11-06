package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.StatsService;
import com.app.xosbextol.service.impl.JpaBookingService;
import com.app.xosbextol.service.UserManagement;
import com.app.xosbextol.security.CurrentUser;
import com.app.xosbextol.model.dto.AdminUserChangeRequestDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final StatsService stats;
    private final UserManagement users;
    private final JpaBookingService bookings;

    @GetMapping("/dashboard")
    Object dashboard() {
        return stats.dashboard();
    }

    @GetMapping("/revenue")
    Object revenue(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(pattern = "yyyy-MM") java.time.YearMonth month) {
        return stats.monthlyRevenue(month);
    }

    @GetMapping("/users")
    Object users(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return users.list(page, size);
    }

    @PatchMapping("/users/{id}")
    void change(@PathVariable long id, @Valid @RequestBody AdminUserChangeRequestDto req) {
        users.change(CurrentUser.id(), id, req.getRole(), req.getStatus());
    }

    @GetMapping("/audit")
    Object audit(@RequestParam(defaultValue = "0") int page,
                 @RequestParam(defaultValue = "20") int size,
                 @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
                 @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return stats.audit(page, size, from, to);
    }

    @GetMapping("/bookings")
    Object bookings(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return bookings.adminList(page, size);
    }
}
