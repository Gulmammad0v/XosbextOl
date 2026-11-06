package com.app.xosbextol.service.impl;

import com.app.xosbextol.service.BookingCalendar;
import com.app.xosbextol.model.value.OccupiedBookingSlot;
import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import com.app.xosbextol.repository.BookingRepository;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingCalendarService implements BookingCalendar {
    private static final List<String> OCCUPYING=List.of(
            BookingStatus.PENDING_APPROVAL.name(),
            BookingStatus.CONFIRMED.name(), BookingStatus.COMPLETED.name());
    private final BookingRepository bookings;

    public List<OccupiedBookingSlot> occupied(long hall, LocalDate from, LocalDate to) {
        return bookings.findOccupied(hall,from,to,OCCUPYING).stream()
                .map(b->new OccupiedBookingSlot(b.getEventDate(),b.getStatus().name())).toList();
    }

    public boolean occupied(long hall, LocalDate date) {
        return !occupied(hall, date, date).isEmpty();
    }

    public List<Long> unavailableHalls(LocalDate date) {
        return bookings.unavailableHallIds(date,OCCUPYING);
    }
}
