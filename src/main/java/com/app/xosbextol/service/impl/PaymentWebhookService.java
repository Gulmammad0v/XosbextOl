package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.dto.PaymentWebhookRequestDto;
import com.app.xosbextol.util.Crypto;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import tools.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;

import java.time.Clock;

@Service
@RequiredArgsConstructor
@Log4j2
public class PaymentWebhookService {
    private final PaymentService payments;
    private final ObjectMapper mapper;
    private final Validator validator;
    private final Clock clock;
    @Value("${app.payment.webhook-secret}")
    private String secret;

    public void handle(String signature, String timestamp, String body) {
        long sent;
        try {
            sent = Long.parseLong(timestamp);
        } catch (RuntimeException ex) {
            throw denied();
        }
        if (secret.length() < 20)
            throw new IllegalStateException("PAYMENT_WEBHOOK_SECRET must contain at least 20 characters");
        if (Math.abs(clock.instant().getEpochSecond() - sent) > 300 || !Crypto.equal(Crypto.hmac(secret, timestamp + "." + body), signature))
            throw denied();
        PaymentWebhookRequestDto event;
        try {
            event = mapper.readValue(body, PaymentWebhookRequestDto.class);
        } catch (RuntimeException ex) {
            log.warn("Payment webhook payload could not be parsed");
            throw BusinessException.invalid("Webhook məlumatı yanlışdır");
        }
        if (!validator.validate(event).isEmpty()) throw BusinessException.invalid("Webhook məlumatı yanlışdır");
        payments.webhook(event);
    }

    private BusinessException denied() {
        log.warn("Payment webhook signature rejected");
        return new BusinessException(HttpStatus.UNAUTHORIZED, "Webhook imzası etibarsızdır");
    }
}
