package com.app.xosbextol.logging;

import org.apache.logging.log4j.core.LoggerContext;
import org.apache.logging.log4j.core.config.ConfigurationSource;
import org.apache.logging.log4j.core.config.xml.XmlConfiguration;
import org.junit.jupiter.api.Test;

import java.util.Objects;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class Log4jConfigurationTest {
    @Test
    void configuresConsoleAndRollingFileAppenders() throws Exception {
        var resource = Objects.requireNonNull(
                getClass().getResource("/log4j2-spring.xml"), "Log4j2 configuration is missing");
        var context = new LoggerContext("log4j-config-test");
        var source = new ConfigurationSource(resource.openStream(), resource);
        var configuration = new XmlConfiguration(context, source);

        try {
            context.start(configuration);
            assertNotNull(configuration.getAppender("Console"));
            assertNotNull(configuration.getAppender("RollingFile"));
        } finally {
            context.stop();
        }
    }
}
