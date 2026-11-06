package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.entity.ReminderDelivery;
import com.app.xosbextol.model.entity.ReminderDeliveryId;
import com.app.xosbextol.repository.BookingRepository;
import com.app.xosbextol.repository.ReminderDeliveryRepository;
import com.app.xosbextol.model.value.BookingReminder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
@Service @RequiredArgsConstructor
public class ReminderService {
    private final ReminderDeliveryRepository deliveries;
    private final BookingRepository bookings;
    private final NotificationService notifications;
    @Transactional public void enqueue(BookingReminder r) {
        var id=new ReminderDeliveryId(r.bookingId(),r.type());
        if(!deliveries.existsById(id)) {
            deliveries.save(new ReminderDelivery(bookings.getReferenceById(r.bookingId()),r.type()));
            notifications.localized(r.userId(),r.type(),r.date());
        }
    }
}
