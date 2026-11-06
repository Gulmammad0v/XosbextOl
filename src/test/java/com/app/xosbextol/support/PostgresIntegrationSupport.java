package com.app.xosbextol.support;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.*;
import org.junit.jupiter.api.Tag;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.utility.DockerImageName;
@SpringBootTest(properties={"app.scheduling.enabled=false","spring.rabbitmq.listener.simple.auto-startup=false"})
@ActiveProfiles("test") @Tag("integration")
public abstract class PostgresIntegrationSupport {
    protected static final PostgreSQLContainer POSTGRES=new PostgreSQLContainer("postgres:17-alpine");
    static final GenericContainer<?> REDIS=new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);
    protected static final GenericContainer<?> MAILPIT=new GenericContainer<>(DockerImageName.parse("axllent/mailpit:v1.27")).withExposedPorts(1025,8025);
    protected static final GenericContainer<?> RABBIT=new GenericContainer<>(DockerImageName.parse("rabbitmq:4.1.4-management"))
        .withEnv("RABBITMQ_DEFAULT_USER","toyapp").withEnv("RABBITMQ_DEFAULT_PASS","test-password").withExposedPorts(5672);
    static { POSTGRES.start();REDIS.start();MAILPIT.start();RABBIT.start(); }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username",POSTGRES::getUsername);
        registry.add("spring.datasource.password",POSTGRES::getPassword);
        registry.add("spring.data.redis.host",REDIS::getHost);
        registry.add("spring.data.redis.port",()->REDIS.getMappedPort(6379));
        registry.add("spring.mail.host",MAILPIT::getHost);
        registry.add("spring.mail.port",()->MAILPIT.getMappedPort(1025));
        registry.add("spring.rabbitmq.host",RABBIT::getHost);
        registry.add("spring.rabbitmq.port",()->RABBIT.getMappedPort(5672));
        registry.add("spring.rabbitmq.username",()->"toyapp");
        registry.add("spring.rabbitmq.password",()->"test-password");
        registry.add("spring.rabbitmq.listener.simple.auto-startup",()->false);
        registry.add("app.jwt.secret",()->"test-secret-with-at-least-32-bytes-xxxxxxxxxx");
        registry.add("app.payment.webhook-secret",()->"test-webhook-secret-xxxxxxxxxx");
    }
}
