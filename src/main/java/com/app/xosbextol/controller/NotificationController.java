package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.NotificationService;
import com.app.xosbextol.service.impl.NotificationPreferenceService;
import com.app.xosbextol.model.dto.NotificationPreferenceRequestDto;
import com.app.xosbextol.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService service;
    private final NotificationPreferenceService preferences;

    @GetMapping
    Object list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(CurrentUser.id(), page, size);
    }

    @GetMapping("/unread-count")
    Object unreadCount() {
        return java.util.Map.of("count", service.unreadCount(CurrentUser.id()));
    }

    @PostMapping("/{id}/read")
    void read(@PathVariable long id) {
        service.read(CurrentUser.id(), id);
    }

    @PostMapping("/read-all")
    void readAll() {
        service.readAll(CurrentUser.id());
    }

    @DeleteMapping
    void delete(@RequestBody List<Long> ids) {
        service.delete(CurrentUser.id(), ids);
    }

    @GetMapping("/preferences")
    Object preferences() {
        return preferences.get(CurrentUser.id());
    }

    @PutMapping("/preferences/{category}")
    Object preference(@PathVariable String category, @Valid @RequestBody NotificationPreferenceRequestDto request) {
        return preferences.set(CurrentUser.id(), category, request.enabled());
    }
}
