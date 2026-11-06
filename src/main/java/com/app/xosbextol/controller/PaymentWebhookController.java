package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.PaymentWebhookService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class PaymentWebhookController {
    private final PaymentWebhookService service;

    @PostMapping("/api/payments/webhook")
    void webhook(@RequestHeader("X-Signature") String signature,
                 @RequestHeader("X-Timestamp") String timestamp, @RequestBody String body) {
        service.handle(signature, timestamp, body);
    }
}
