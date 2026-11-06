package com.app.xosbextol.service.impl;

import com.app.xosbextol.config.RabbitConfig;
import com.app.xosbextol.repository.NotificationOutboxRepository;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
@Log4j2
public class NotificationConsumer {
    private final NotificationOutboxRepository outbox;
    private final ChannelDelivery delivery;
    private final RabbitTemplate rabbit;

    @RabbitListener(queues = RabbitConfig.QUEUE)
    @Transactional
    public void consume(Long notificationId) {
        var entry = outbox.lockByNotificationId(notificationId).orElse(null);
        if (entry == null || "SENT".equals(entry.getStatus()) || "DEAD".equals(entry.getStatus())) {
            log.debug("Notification delivery skipped notificationId={}", notificationId);
            return;
        }
        try {
            var result = delivery.send(entry.getNotification());
            entry.setStatus("SENT");
            entry.getNotification().setPushStatus(result.name());
            if (result == ChannelDelivery.Result.SENT) {
                entry.getNotification().setPushSentAt(java.time.Instant.now());
            }
            log.info("Notification delivery completed notificationId={} result={}", notificationId, result);
        } catch (RuntimeException ex) {
            int attempts = entry.getAttempts() + 1;
            entry.setAttempts(attempts);
            entry.setStatus(attempts >= 10 ? "DEAD" : "PENDING");
            entry.getNotification().setPushStatus(attempts >= 10 ? "FAILED" : "PENDING");
            entry.setNextAttemptAt(java.time.Instant.now().plus(java.time.Duration.ofMinutes(Math.min(attempts * attempts, 60))));
            if (attempts >= 10) {
                rabbit.convertAndSend("", RabbitConfig.DEAD_QUEUE, notificationId);
                log.error("Notification moved to dead-letter queue notificationId={} attempts={}", notificationId, attempts, ex);
            } else {
                log.warn("Notification delivery deferred notificationId={} attempts={}", notificationId, attempts, ex);
            }
        }
    }
}
