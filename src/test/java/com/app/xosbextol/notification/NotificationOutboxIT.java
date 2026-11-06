package com.app.xosbextol.notification;

import com.app.xosbextol.support.PostgresIntegrationSupport;
import com.app.xosbextol.service.impl.NotificationService;
import com.app.xosbextol.service.impl.OutboxPublisher;
import com.app.xosbextol.service.impl.NotificationConsumer;
import com.app.xosbextol.config.RabbitConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class NotificationOutboxIT extends PostgresIntegrationSupport {
    @Autowired
    NotificationService notifications;
    @Autowired
    OutboxPublisher publisher;
    @Autowired
    NotificationConsumer consumer;
    @Autowired
    RabbitTemplate rabbit;
    @Autowired
    RabbitListenerEndpointRegistry listeners;
    @Autowired
    JdbcTemplate jdbc;

    @Test
    void dedupKeyCreatesOnlyOneDatabaseNotificationAndOutboxEntry() {
        long user = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class,
                "dedup" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");

        notifications.enqueue(user, "BOOKING_CONFIRMED", "Təsdiqləndi", "Mətn", "/bookings", "BOOKING_CONFIRMED:42");
        notifications.enqueue(user, "BOOKING_CONFIRMED", "Təsdiqləndi", "Mətn", "/bookings", "BOOKING_CONFIRMED:42");

        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where user_id=?", Integer.class, user));
        assertEquals(1, jdbc.queryForObject("select count(*) from notification_outbox o join notifications n on n.id=o.notification_id where n.user_id=?", Integer.class, user));
    }

    @Test
    void allNotificationsCanBeMarkedReadTogether() {
        long user = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class,
                "readall" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        notifications.enqueue(user, "TEST", "Bir", "Birinci bildiriş");
        notifications.enqueue(user, "TEST", "İki", "İkinci bildiriş");
        assertEquals(2, notifications.unreadCount(user));
        notifications.readAll(user);
        assertEquals(0, notifications.unreadCount(user));
    }

    @Test
    void oneNotificationCanBeMarkedReadWhenOpened() {
        long user = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class,
                "readone" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        notifications.enqueue(user, "TEST", "Rezervasiya", "Bildiriş mətni");
        long pushId = jdbc.queryForObject("select id from notifications where user_id=?", Long.class, user);

        notifications.read(user, pushId);

        assertEquals(0, notifications.unreadCount(user));
        assertNotNull(jdbc.queryForObject("select read_at from notifications where id=?", java.time.Instant.class, pushId));
    }

    @Test
    void selectedNotificationsCanBeDeletedOnlyByTheirOwner() {
        long owner = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class,
                "delete" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        long other = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class,
                "other" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        notifications.enqueue(owner, "TEST", "Owner", "Silinəcək bildiriş");
        notifications.enqueue(other, "TEST", "Other", "Qorunacaq bildiriş");
        long ownerPush = jdbc.queryForObject("select id from notifications where user_id=?", Long.class, owner);
        long otherPush = jdbc.queryForObject("select id from notifications where user_id=?", Long.class, other);

        notifications.delete(owner, java.util.List.of(ownerPush, otherPush));

        assertEquals(0, jdbc.queryForObject("select count(*) from notifications where id=?", Integer.class, ownerPush));
        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where id=?", Integer.class, otherPush));
    }

    @Test
    void committedOutboxPublishesAndConsumerIsIdempotent() {
        listeners.stop();
        long user = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'en',now(),now()) returning id", Long.class, "notify" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        notifications.localized(user, "BOOKING_CONFIRMED", "1", "2026-12-20");
        assertEquals("Booking confirmed", jdbc.queryForObject("select title from notifications where user_id=? limit 1", String.class, user));
        new RabbitAdmin(rabbit.getConnectionFactory()).declareQueue(new org.springframework.amqp.core.Queue(RabbitConfig.QUEUE, true, false, false, java.util.Map.of("x-dead-letter-exchange", "toyapp.notifications.dlx")));
        for (int i = 0; i < 10; i++) publisher.publishBatch();
        int delivered = 0;
        Object message;
        while ((message = rabbit.receiveAndConvert(RabbitConfig.QUEUE, 1000)) != null) {
            consumer.consume(((Number) message).longValue());
            delivered++;
        }
        assertTrue(delivered >= 1);
        var ids = jdbc.queryForList("select n.id from notifications n where n.user_id=?", Long.class, user);
        for (long id : ids) consumer.consume(id);
        assertEquals(1, jdbc.queryForObject("select count(*) from notification_outbox o join notifications n on n.id=o.notification_id where n.user_id=? and o.status='SENT'", Integer.class, user));
    }
}
