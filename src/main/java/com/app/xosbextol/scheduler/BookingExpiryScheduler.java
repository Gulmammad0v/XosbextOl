package com.app.xosbextol.scheduler;

import com.app.xosbextol.service.impl.JpaBookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;

@Component
@RequiredArgsConstructor
@Log4j2
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class BookingExpiryScheduler {
    private final JpaBookingService service;

    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void expire() {
        var expiredIds = service.expiredBookingIds(100);
        var completionIds = service.bookingsReadyToComplete(100);
        var reviewPromptIds = service.bookingsReadyForReviewPrompt(100);
        if (!expiredIds.isEmpty() || !completionIds.isEmpty() || !reviewPromptIds.isEmpty()) {
            log.info("Processing booking lifecycle batch expirations={} completions={} reviewPrompts={}",
                    expiredIds.size(), completionIds.size(), reviewPromptIds.size());
        }
        for (long id : expiredIds) {
            try {
                service.expire(id);
            } catch (RuntimeException ex) {
                log.warn("Booking expiry deferred bookingId={}", id, ex);
            }
        }
        for (long id : completionIds) {
            try {
                service.complete(id);
            } catch (RuntimeException ex) {
                log.warn("Booking completion deferred bookingId={}", id, ex);
            }
        }
        for (long id : reviewPromptIds) {
            try {
                service.sendReviewPrompt(id);
            } catch (RuntimeException ex) {
                log.warn("Review prompt deferred bookingId={}", id, ex);
            }
        }
    }
}
