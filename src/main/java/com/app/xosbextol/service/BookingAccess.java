package com.app.xosbextol.service;

import com.app.xosbextol.model.value.BookingSnapshot;
import java.math.BigDecimal;
import com.app.xosbextol.model.dto.CreateBookingRequestDto;
public interface BookingAccess {
    BookingSnapshot get(long id);
    BookingSnapshot lock(long id);
    void acceptPayment(long id,BigDecimal amount);
    void refunded(long id,BigDecimal totalRefunded);
    boolean completedBy(long bookingId,long userId);
    BigDecimal quoteDeposit(long userId, CreateBookingRequestDto request);
    BookingSnapshot createPaid(long userId, CreateBookingRequestDto request, String key, BigDecimal paidAmount);
}
