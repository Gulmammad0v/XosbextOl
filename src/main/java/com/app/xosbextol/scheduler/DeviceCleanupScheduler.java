package com.app.xosbextol.scheduler;

import com.app.xosbextol.service.impl.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DeviceCleanupScheduler {
    private final AuthService auth;

    @Scheduled(cron = "${app.auth.device-cleanup-cron:0 30 3 * * *}", zone = "UTC")
    public void deleteStaleDevices() {
        auth.cleanupStaleDevices();
    }
}
