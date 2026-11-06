package com.app.xosbextol.scheduler;

import com.app.xosbextol.service.impl.RefundService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Log4j2
@ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class RefundScheduler {
    private final RefundService refunds;

    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void run() {
        var ids = refunds.requestedIds(100);
        if (!ids.isEmpty()) log.info("Processing refund batch size={}", ids.size());
        for (long id : ids) {
            try {
                refunds.process(id);
            } catch (RuntimeException ex) {
                log.warn("Refund deferred refundId={}; same idempotency key will be retried", id, ex);
            }
        }
    }
}
