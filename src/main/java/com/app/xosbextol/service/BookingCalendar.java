package com.app.xosbextol.service;

import com.app.xosbextol.model.value.OccupiedBookingSlot;
import java.time.LocalDate;
import java.util.List;
public interface BookingCalendar {
    List<OccupiedBookingSlot> occupied(long hallId,LocalDate from,LocalDate to);
    boolean occupied(long hallId,LocalDate date);
    List<Long> unavailableHalls(LocalDate date);
}
