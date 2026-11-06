package com.app.xosbextol.config;

import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;

import java.net.URI;
import java.time.Duration;

@Configuration
public class StorageConfig {
    @Bean
    S3Client s3(@Value("${app.storage.endpoint}") String endpoint, @Value("${app.storage.region}") String region,
                @Value("${app.storage.access-key}") String access, @Value("${app.storage.secret-key}") String secret) {
        var builder = S3Client.builder().region(Region.of(region)).forcePathStyle(true)
                .overrideConfiguration(ClientOverrideConfiguration.builder().apiCallTimeout(Duration.ofSeconds(30)).apiCallAttemptTimeout(Duration.ofSeconds(10)).build());
        if (!endpoint.isBlank()) builder.endpointOverride(URI.create(endpoint));
        builder.credentialsProvider(access.isBlank() ? DefaultCredentialsProvider.builder().build() : StaticCredentialsProvider.create(AwsBasicCredentials.create(access, secret)));
        return builder.build();
    }
}
