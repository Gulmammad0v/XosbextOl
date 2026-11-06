package com.app.xosbextol.service;

import com.app.xosbextol.repository.AuditLogRepository;
import com.app.xosbextol.repository.UserRepository;
import com.app.xosbextol.service.impl.AuditService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class AuditServiceTest {
    @Test
    void deletesAuditLogsOlderThanOneCalendarMonth() {
        var audits = mock(AuditLogRepository.class);
        var clock = Clock.fixed(Instant.parse("2026-03-31T03:00:00Z"), ZoneOffset.UTC);
        var service = new AuditService(audits, mock(UserRepository.class), clock);
        when(audits.deleteByCreatedAtBefore(any())).thenReturn(7L);

        assertEquals(7L, service.deleteExpired());

        var cutoff = ArgumentCaptor.forClass(Instant.class);
        verify(audits).deleteByCreatedAtBefore(cutoff.capture());
        assertEquals(Instant.parse("2026-02-28T03:00:00Z"), cutoff.getValue());
    }
}
