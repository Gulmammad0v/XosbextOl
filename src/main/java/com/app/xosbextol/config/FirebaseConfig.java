package com.app.xosbextol.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

@Configuration
@ConditionalOnProperty(name = "app.notification.firebase-enabled", havingValue = "true")
public class FirebaseConfig {
    @Bean(destroyMethod = "delete")
    FirebaseApp firebaseApp(@Value("${app.notification.firebase-credentials:}") String credentialsPath)
            throws IOException {
        GoogleCredentials credentials;
        if (credentialsPath == null || credentialsPath.isBlank()) {
            credentials = GoogleCredentials.getApplicationDefault();
        } else {
            try (var input = Files.newInputStream(Path.of(credentialsPath))) {
                credentials = GoogleCredentials.fromStream(input);
            }
        }
        return FirebaseApp.initializeApp(
                FirebaseOptions.builder().setCredentials(credentials).build(),
                "xosbextol-" + UUID.randomUUID());
    }

    @Bean
    FirebaseMessaging firebaseMessaging(FirebaseApp firebaseApp) {
        return FirebaseMessaging.getInstance(firebaseApp);
    }
}
