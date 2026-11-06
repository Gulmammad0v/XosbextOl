package com.app.xosbextol.service.impl;

import com.app.xosbextol.service.BookingReminders;
import com.app.xosbextol.model.value.BookingReminder;
import com.app.xosbextol.model.enums.BookingStatus;
import com.app.xosbextol.repository.BookingRepository;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingReminderService implements BookingReminders {
    private final BookingRepository bookings;

    public List<BookingReminder> due() {
        var today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Baku"));
        return bookings.findByStatusCodeAndEventDateIn(BookingStatus.CONFIRMED.name(), List.of(today.plusDays(1), today.plusDays(7))).stream()
                .map(b -> new BookingReminder(b.getId(), b.getUserId(), b.getEventDate().equals(today.plusDays(1)) ? "REMINDER_1D" : "REMINDER_7D", b.getEventDate().toString())).toList();
    }
}
