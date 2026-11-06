package com.app.xosbextol.scheduler;

import com.app.xosbextol.service.impl.JpaBookingService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.mockito.Mockito.*;

class BookingExpirySchedulerTest {
    @Test
    void expiresApprovalRequestsWhoseDeadlinePassed() {
        JpaBookingService bookings = mock(JpaBookingService.class);
        when(bookings.expiredBookingIds(100)).thenReturn(List.of(15L, 16L));
        when(bookings.bookingsReadyToComplete(100)).thenReturn(List.of());
        when(bookings.bookingsReadyForReviewPrompt(100)).thenReturn(List.of());

        new BookingExpiryScheduler(bookings).expire();

        verify(bookings).expire(15L);
        verify(bookings).expire(16L);
    }
}
