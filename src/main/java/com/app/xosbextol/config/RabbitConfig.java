package com.app.xosbextol.config;

import org.springframework.context.annotation.*;
import org.springframework.amqp.core.*;

@Configuration
public class RabbitConfig {
    public static final String QUEUE = "toyapp.notifications";
    public static final String DEAD_QUEUE = "toyapp.notifications.dead";

    @Bean
    Queue notificationQueue() {
        return QueueBuilder.durable(QUEUE).deadLetterExchange("toyapp.notifications.dlx").build();
    }

    @Bean
    DirectExchange deadLetterExchange() {
        return new DirectExchange("toyapp.notifications.dlx");
    }

    @Bean
    Queue deadLetterQueue() {
        return QueueBuilder.durable(DEAD_QUEUE).build();
    }

    @Bean
    Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with(QUEUE);
    }
}
