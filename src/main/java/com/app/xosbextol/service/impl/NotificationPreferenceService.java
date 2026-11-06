package com.app.xosbextol.service.impl;

import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.model.entity.NotificationPreference;
import com.app.xosbextol.model.enums.Role;
import com.app.xosbextol.repository.NotificationPreferenceRepository;
import com.app.xosbextol.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {
    public static final String REMINDER = "REMINDER";
    public static final String RESPONSE_REMINDER = "RESPONSE_REMINDER";
    public static final String REVIEW = "REVIEW";
    public static final String PROMO = "PROMO";

    private static final Set<String> CUSTOMER_CATEGORIES = Set.of(REMINDER, REVIEW, PROMO);
    private static final Set<String> OWNER_CATEGORIES = Set.of(RESPONSE_REMINDER, REMINDER, REVIEW, PROMO);

    private final NotificationPreferenceRepository preferences;
    private final UserRepository users;

    @Transactional(readOnly = true)
    public Map<String, Boolean> get(long userId) {
        var user = users.findById(userId).orElseThrow(() -> BusinessException.missing("İstifadəçi"));
        var result = defaults(user.getRole());
        preferences.findByUser_Id(userId).forEach(preference -> {
            if (result.containsKey(preference.getCategory())) {
                result.put(preference.getCategory(), preference.isEnabled());
            }
        });
        return result;
    }

    @Transactional
    public Map<String, Boolean> set(long userId, String rawCategory, boolean enabled) {
        var user = users.findById(userId).orElseThrow(() -> BusinessException.missing("İstifadəçi"));
        String category = rawCategory == null ? "" : rawCategory.strip().toUpperCase(java.util.Locale.ROOT);
        if (!categories(user.getRole()).contains(category)) {
            throw BusinessException.invalid("Bildiriş kateqoriyası dəyişdirilə bilməz");
        }
        var preference = preferences.findByUser_IdAndCategory(userId, category).orElseGet(() -> {
            var created = new NotificationPreference();
            created.setUser(user);
            created.setCategory(category);
            return created;
        });
        preference.setEnabled(enabled);
        preferences.save(preference);
        return get(userId);
    }

    @Transactional(readOnly = true)
    public boolean allows(long userId, String notificationType) {
        String category = optionalCategory(notificationType);
        if (category == null) return true;
        return preferences.findByUser_IdAndCategory(userId, category)
                .map(NotificationPreference::isEnabled)
                .orElse(!PROMO.equals(category));
    }

    static String optionalCategory(String type) {
        if (type == null) return null;
        if (type.startsWith("RESPONSE_REMINDER") || type.startsWith("BOOKING_RESPONSE_REMINDER")) return RESPONSE_REMINDER;
        if (type.startsWith("REMINDER") || type.startsWith("EVENT_REMINDER")) return REMINDER;
        if (type.startsWith("REVIEW") || type.startsWith("NEW_REVIEW")) return REVIEW;
        if (type.startsWith("PROMO") || type.startsWith("MARKETING")) return PROMO;
        return null;
    }

    private Map<String, Boolean> defaults(Role role) {
        var result = new LinkedHashMap<String, Boolean>();
        categories(role).forEach(category -> result.put(category, !PROMO.equals(category)));
        return result;
    }

    private Set<String> categories(Role role) {
        return role == Role.VENUE_OWNER ? OWNER_CATEGORIES : CUSTOMER_CATEGORIES;
    }
}
