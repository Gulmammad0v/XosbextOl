package com.app.xosbextol.scheduler;

import com.app.xosbextol.service.impl.PaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;

@Component
@RequiredArgsConstructor
@Log4j2
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name = "app.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class PaymentReconciliationJob {
    private final PaymentService service;

    @Scheduled(fixedDelay = 120000, initialDelay = 120000)
    public void reconcile() {
        var ids = service.unfinished();
        if (!ids.isEmpty()) log.info("Reconciling payment batch size={}", ids.size());
        for (long id : ids) {
            try {
                service.reconcile(id);
            } catch (RuntimeException ex) {
                log.warn("Payment reconciliation deferred paymentId={}", id, ex);
            }
        }
    }
}
