package com.app.xosbextol.scheduler;

import com.app.xosbextol.service.impl.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Log4j2
public class AuditCleanupScheduler {
    private final AuditService audit;

    @Scheduled(cron = "${app.audit.cleanup-cron:0 0 3 * * *}", zone = "UTC")
    public void deleteExpiredAuditLogs() {
        long deleted = audit.deleteExpired();
        if (deleted > 0) log.info("Expired audit logs deleted count={}", deleted);
    }
}
