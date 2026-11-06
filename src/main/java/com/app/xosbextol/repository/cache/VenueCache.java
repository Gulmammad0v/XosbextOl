package com.app.xosbextol.repository.cache;

import com.app.xosbextol.model.dto.VenueDetailResponseDto;
import com.app.xosbextol.model.dto.VenueItemResponseDto;
import com.app.xosbextol.model.dto.PageResponse;
import com.app.xosbextol.util.Crypto;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.support.*;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;

import java.time.Duration;
import java.util.function.Supplier;

@Component
@RequiredArgsConstructor
@Log4j2
public class VenueCache {
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    public VenueDetailResponseDto detail(long id, Supplier<VenueDetailResponseDto> source) {
        String key = "venue:detail:" + id;
        try {
            var json = redis.opsForValue().get(key);
            if (json != null) return mapper.readValue(json, VenueDetailResponseDto.class);
        } catch (RuntimeException ex) {
            log.debug("Venue detail cache read failed venueId={}", id, ex);
        }
        var value = source.get();
        try {
            redis.opsForValue().set(key, mapper.writeValueAsString(value), Duration.ofMinutes(5));
        } catch (RuntimeException ex) {
            log.debug("Venue detail cache write failed venueId={}", id, ex);
        }
        return value;
    }

    public PageResponse<VenueItemResponseDto> list(String filters, Supplier<PageResponse<VenueItemResponseDto>> source) {
        String key;
        try {
            String version = redis.opsForValue().get("venue:cache:version");
            key = "venue:list:" + version + ":" + Crypto.sha256(filters);
        } catch (RuntimeException ex) {
            log.debug("Venue list cache version read failed", ex);
            return source.get();
        }
        try {
            var json = redis.opsForValue().get(key);
            if (json != null) return mapper.readValue(json, new TypeReference<PageResponse<VenueItemResponseDto>>() {
            });
        } catch (RuntimeException ex) {
            log.debug("Venue list cache read failed", ex);
        }
        var value = source.get();
        try {
            redis.opsForValue().set(key, mapper.writeValueAsString(value), Duration.ofSeconds(60));
        } catch (RuntimeException ex) {
            log.debug("Venue list cache write failed", ex);
        }
        return value;
    }

    public void changed(long venueId) {
        Runnable evict = () -> {
            try {
                redis.delete("venue:detail:" + venueId);
                redis.opsForValue().increment("venue:cache:version");
            } catch (RuntimeException ex) {
                log.warn("Venue cache eviction failed venueId={}", venueId, ex);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    evict.run();
                }
            });
        else evict.run();
    }
}
