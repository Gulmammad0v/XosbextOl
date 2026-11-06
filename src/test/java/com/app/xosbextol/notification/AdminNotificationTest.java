package com.app.xosbextol.notification;

import com.app.xosbextol.model.entity.Notification;
import com.app.xosbextol.model.entity.User;
import com.app.xosbextol.repository.NotificationOutboxRepository;
import com.app.xosbextol.repository.NotificationRepository;
import com.app.xosbextol.repository.UserRepository;
import com.app.xosbextol.service.UserAccess;
import com.app.xosbextol.service.impl.NotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.MessageSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

class AdminNotificationTest {
    @Test
    void reviewReportNotificationIsQueuedForEveryActiveAdmin() {
        var notifications = mock(NotificationRepository.class);
        var outbox = mock(NotificationOutboxRepository.class);
        var userRepository = mock(UserRepository.class);
        var users = mock(UserAccess.class);
        var service = new NotificationService(notifications, outbox, userRepository, users, mock(MessageSource.class));
        when(userRepository.findActiveAdminIds()).thenReturn(List.of(11L, 12L));
        when(userRepository.getReferenceById(anyLong())).thenAnswer(invocation -> {
            var user = new User();
            return user;
        });

        service.enqueueForActiveAdmins("REVIEW_REPORTED", "Yeni rəy şikayəti", "Şikayət mətni", "/admin/reviewReports");

        verify(users).contact(11L);
        verify(users).contact(12L);
        verify(outbox, times(2)).save(any());
        var entries = ArgumentCaptor.forClass(Notification.class);
        verify(notifications, times(2)).save(entries.capture());
        assertEquals(2, entries.getAllValues().size());
        assertTrue(entries.getAllValues().stream().allMatch(item -> item.getType().equals("REVIEW_REPORTED")
                && item.getDeepLink().equals("/admin/reviewReports")));
    }
}
