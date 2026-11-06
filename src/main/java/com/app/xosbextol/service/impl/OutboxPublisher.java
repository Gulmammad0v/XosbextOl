package com.app.xosbextol.service.impl;

import com.app.xosbextol.config.RabbitConfig;
import com.app.xosbextol.repository.NotificationOutboxRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.util.concurrent.TimeUnit;

@Service @RequiredArgsConstructor
public class OutboxPublisher {
    private final NotificationOutboxRepository outbox;
    private final RabbitTemplate rabbit;

    @Transactional public void publishBatch() {
        var rows=outbox.lockPending(java.time.Instant.now(),PageRequest.of(0,20));
        for(var row:rows) {
            long id=row.getId();
            var correlation=new CorrelationData(Long.toString(id));
            try {
                rabbit.convertAndSend("",RabbitConfig.QUEUE,row.getNotification().getId(),correlation);
                var confirm=correlation.getFuture().get(5,TimeUnit.SECONDS);
                if(!confirm.ack() || correlation.getReturned()!=null) throw new IllegalStateException("Broker rejected notification");
                row.setStatus("QUEUED");row.setPublishedAt(java.time.Instant.now());
            } catch(Exception ex) {
                if(ex instanceof InterruptedException) Thread.currentThread().interrupt();
                throw new IllegalStateException("Notification publishing deferred",ex);
            }
        }
    }
}
