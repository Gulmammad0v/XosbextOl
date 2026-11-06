package com.app.xosbextol.service.impl;

import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.model.entity.Notification;
import com.app.xosbextol.model.entity.NotificationOutbox;
import com.app.xosbextol.model.dto.NotificationResponseDto;
import com.app.xosbextol.repository.NotificationOutboxRepository;
import com.app.xosbextol.repository.NotificationRepository;
import com.app.xosbextol.repository.UserRepository;
import com.app.xosbextol.service.UserAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notifications;
    private final NotificationOutboxRepository outbox;
    private final UserRepository userRepository;
    private final UserAccess users;
    private final org.springframework.context.MessageSource messages;

    @Transactional
    public void localized(long user, String type, Object... arguments) {
        localizedDeduplicated(user, type, null, null, arguments);
    }

    @Transactional
    public void localizedWithAction(long user, String type, String deepLink, Object... arguments) {
        localizedDeduplicated(user, type, deepLink, null, arguments);
    }

    @Transactional
    public void localizedDeduplicated(long user, String type, String deepLink, String dedupKey, Object... arguments) {
        var locale = Locale.forLanguageTag(users.contact(user).language());
        enqueue(user, type, messages.getMessage("notification." + type + ".title", null, locale),
                messages.getMessage("notification." + type + ".body", arguments, locale), deepLink, dedupKey);
    }

    @Transactional
    public void enqueue(long user, String type, String title, String body) {
        enqueue(user, type, title, body, null, null);
    }

    @Transactional
    public void enqueue(long user, String type, String title, String body, String deepLink) {
        enqueue(user, type, title, body, deepLink, null);
    }

    @Transactional
    public void enqueue(long user, String type, String title, String body, String deepLink, String dedupKey) {
        users.contact(user);
        var userEntity = dedupKey == null
                ? userRepository.getReferenceById(user)
                : userRepository.lock(user).orElseThrow();
        if (dedupKey != null && notifications.existsByUser_IdAndDedupKey(user, dedupKey)) return;

        var notification = new Notification();
        notification.setUser(userEntity);
        notification.setType(type);
        notification.setTitle(title);
        notification.setBody(body);
        notification.setDeepLink(deepLink);
        notification.setDedupKey(dedupKey);
        notifications.save(notification);

        var entry = new NotificationOutbox();
        entry.setNotification(notification);
        outbox.save(entry);
    }

    @Transactional
    public void enqueueForActiveAdmins(String type, String title, String body, String deepLink) {
        userRepository.findActiveAdminIds().forEach(adminId -> enqueue(adminId, type, title, body, deepLink));
    }

    public Map<String, Object> list(long user, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw BusinessException.invalid("Səhifə ölçüsü 1–100 olmalıdır");
        }
        var result = notifications.findVisible(user,
                PageRequest.of(page, size, Sort.by("id").descending()));
        var content = result.getContent().stream()
                .map(n -> new NotificationResponseDto(n.getId(), n.getType(), n.getTitle(), n.getBody(),
                        n.getDeepLink(), n.isRead(), n.getReadAt(), n.getCreatedAt()))
                .toList();
        return Map.of("content", content, "page", page, "size", size,
                "totalElements", result.getTotalElements());
    }

    public long unreadCount(long user) {
        return notifications.countUnread(user);
    }

    @Transactional
    public void readAll(long user) {
        notifications.markAllRead(user, Instant.now());
    }

    @Transactional
    public void read(long user, long id) {
        var notification = notifications.findVisibleById(id, user)
                .orElseThrow(() -> BusinessException.missing("Bildiriş"));
        if (notification.getReadAt() == null) notification.setReadAt(Instant.now());
    }

    @Transactional
    public void delete(long user, List<Long> ids) {
        if (ids == null || ids.isEmpty()) return;
        var uniqueIds = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (uniqueIds.size() > 100) {
            throw BusinessException.invalid("Bir dəfəyə ən çox 100 bildiriş silinə bilər");
        }
        outbox.deleteOwned(uniqueIds, user);
        notifications.deleteOwned(uniqueIds, user);
    }
}
