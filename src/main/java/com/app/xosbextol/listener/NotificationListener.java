package com.app.xosbextol.listener;

import com.app.xosbextol.service.impl.NotificationService;
import com.app.xosbextol.model.event.*;
import org.springframework.stereotype.Component;
import org.springframework.context.event.EventListener;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class NotificationListener {
    private final NotificationService service;

    @EventListener
    public void confirmed(BookingConfirmedEvent e) {
        service.localizedDeduplicated(e.userId(), "BOOKING_CONFIRMED", "/bookings",
                "BOOKING_CONFIRMED:" + e.bookingId(), e.bookingNumber(), e.eventDate().toString());
    }

    @EventListener
    public void approvalRequested(BookingApprovalRequestedEvent e) {
        service.localizedDeduplicated(e.ownerId(), "BOOKING_APPROVAL_REQUIRED",
                "/partner/booking-detail?bookingId=" + e.bookingId(),
                "BOOKING_APPROVAL_REQUIRED:" + e.bookingId(), e.bookingNumber(), e.eventDate().toString(), e.hallName());
    }

    @EventListener
    public void rejected(BookingRejectedEvent e) {
        service.localizedDeduplicated(e.userId(), "BOOKING_REJECTED", "/bookings",
                "BOOKING_REJECTED:" + e.bookingId(), e.bookingNumber(), e.reason());
    }

    @EventListener
    public void cancelled(BookingCancelledEvent e) {
        service.localizedDeduplicated(e.userId(), "BOOKING_CANCELLED", "/bookings",
                "BOOKING_CANCELLED:" + e.bookingId(), e.bookingNumber());
    }
}
