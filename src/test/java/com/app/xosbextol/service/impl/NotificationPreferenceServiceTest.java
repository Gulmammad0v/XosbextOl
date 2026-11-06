package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.entity.NotificationPreference;
import com.app.xosbextol.repository.NotificationPreferenceRepository;
import com.app.xosbextol.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NotificationPreferenceServiceTest {
    private final NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
    private final NotificationPreferenceService service = new NotificationPreferenceService(preferences, mock(UserRepository.class));

    @Test
    void mandatoryTypesAlwaysPassWhileOptionalTypesRespectPreference() {
        var disabledReminder = new NotificationPreference();
        disabledReminder.setCategory(NotificationPreferenceService.REMINDER);
        disabledReminder.setEnabled(false);
        when(preferences.findByUser_IdAndCategory(42, NotificationPreferenceService.REMINDER))
                .thenReturn(Optional.of(disabledReminder));

        assertTrue(service.allows(42, "BOOKING_CONFIRMED"));
        assertTrue(service.allows(42, "PAYMENT_REFUNDED"));
        assertFalse(service.allows(42, "REMINDER_1D"));
    }

    @Test
    void marketingIsOffByDefaultAndReviewRemindersAreOn() {
        when(preferences.findByUser_IdAndCategory(42, NotificationPreferenceService.PROMO))
                .thenReturn(Optional.empty());
        when(preferences.findByUser_IdAndCategory(42, NotificationPreferenceService.REVIEW))
                .thenReturn(Optional.empty());

        assertFalse(service.allows(42, "PROMO"));
        assertTrue(service.allows(42, "REVIEW_REQUEST"));
    }
}
