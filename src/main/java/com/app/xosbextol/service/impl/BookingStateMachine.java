package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.enums.BookingStatus;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class BookingStateMachine {
    private static final Map<BookingStatus, Set<BookingStatus>> ALLOWED = Map.of(
            BookingStatus.PENDING_APPROVAL, Set.of(BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.CANCELLED),
            BookingStatus.CONFIRMED, Set.of(BookingStatus.COMPLETED, BookingStatus.CANCELLED));

    public void check(BookingStatus from, BookingStatus to) {
        if (!ALLOWED.getOrDefault(from, Set.of()).contains(to))
            throw BusinessException.conflict("Status keçidi mümkün deyil: " + from + " → " + to);
    }
}
