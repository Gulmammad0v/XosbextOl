package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.PaymentService;
import com.app.xosbextol.model.dto.CreateBookingRequestDto;
import com.app.xosbextol.model.dto.PaymentResponseDto;
import com.app.xosbextol.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService service;

    @PostMapping("/booking-checkout")
    PaymentResponseDto checkout(@Valid @RequestBody CreateBookingRequestDto req, @RequestHeader("Idempotency-Key") String key) {
        return service.checkout(CurrentUser.id(), req, key);
    }

    @GetMapping("/{id}")
    PaymentResponseDto detail(@PathVariable long id) {
        return service.detail(CurrentUser.id(), id);
    }
}
