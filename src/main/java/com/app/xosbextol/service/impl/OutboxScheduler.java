package com.app.xosbextol.service.impl;

import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

@Component @RequiredArgsConstructor @Log4j2
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="app.scheduling.enabled",havingValue="true",matchIfMissing=true)
public class OutboxScheduler {
    private final OutboxPublisher publisher;

    @Scheduled(fixedDelay=5000,initialDelay=10000) public void publish() {
        try {
            publisher.publishBatch();
        } catch(RuntimeException ex) {
            log.warn("Notification outbox publishing deferred", ex);
        }
    }
}
