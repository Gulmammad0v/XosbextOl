package com.app.xosbextol.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Component
@Order(-300)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.storage.initialize-bucket", havingValue = "true")
@Log4j2
public class StorageBucketInitializer implements ApplicationRunner {
    private final S3Client s3;

    @Value("${app.storage.bucket}")
    private String bucket;

    @Override
    public void run(ApplicationArguments args) {
        try {
            s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            log.info("Storage bucket is available bucket={}", bucket);
        } catch (S3Exception ex) {
            if (ex.statusCode() != 404) throw ex;
            s3.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
            log.info("Storage bucket created bucket={}", bucket);
        }
    }
}
