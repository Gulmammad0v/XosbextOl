package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.enums.PaymentStatus;
import com.app.xosbextol.model.entity.Refund;
import com.app.xosbextol.repository.PaymentRepository;
import com.app.xosbextol.repository.RefundRepository;
import com.app.xosbextol.service.BookingAccess;
import com.app.xosbextol.model.event.BookingCancelledEvent;
import com.app.xosbextol.model.event.BookingRejectedEvent;
import com.app.xosbextol.client.payment.PaymentGateway;
import org.springframework.stereotype.Service;
import org.springframework.context.event.EventListener;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;

import org.springframework.data.domain.PageRequest;

@Service
@RequiredArgsConstructor
public class RefundService {
    private final RefundRepository refunds;
    private final PaymentRepository payments;
    private final PaymentGateway gateway;
    private final BookingAccess bookings;
    private final AuditService audit;
    private final Clock clock;

    @EventListener
    @Transactional
    public void request(BookingCancelledEvent event) {
        BigDecimal nonRefundable = event.depositAmount().min(event.paidAmount());
        for (var payment : payments.findByBooking_IdOrderById(event.bookingId())) {
            if (payment.getStatus() != PaymentStatus.SUCCESS) continue;
            BigDecimal withheld = nonRefundable.min(payment.getAmount());
            BigDecimal refundable = payment.getAmount().subtract(withheld);
            nonRefundable = nonRefundable.subtract(withheld);
            if (refundable.signum() > 0 && !refunds.existsByPayment_Id(payment.getId())) {
                var refund = new Refund();
                refund.setPayment(payment);
                refund.setBooking(payment.getBooking());
                refund.setAmount(refundable);
                refund.setReason(event.reason());
                refunds.save(refund);
            }
        }
    }

    @EventListener
    @Transactional
    public void request(BookingRejectedEvent event) {
        for (var payment : payments.findByBooking_IdOrderById(event.bookingId())) {
            if (payment.getStatus() != PaymentStatus.SUCCESS || refunds.existsByPayment_Id(payment.getId())) continue;
            var refund = new Refund();
            refund.setPayment(payment);
            refund.setBooking(payment.getBooking());
            refund.setAmount(payment.getAmount());
            refund.setReason(event.reason());
            refunds.save(refund);
        }
    }

    @Transactional
    public void process(long id) {
        var r = refunds.lock(id).orElseThrow();
        long booking = r.getBooking().getId();
        bookings.lock(booking);
        if (!"REQUESTED".equals(r.getStatus())) return;
        String ref = gateway.refund(r.getPayment().getProviderTxId(), r.getAmount(), "refund-" + id);
        r.setStatus("PROCESSED");
        r.setProviderRef(ref);
        r.setProcessedAt(clock.instant());
        r.getPayment().setStatus(PaymentStatus.REFUNDED);
        var total = refunds.processedTotal(booking);
        bookings.refunded(booking, total);
        audit.record(null, "REFUND_PROCESSED", "REFUND", id);
    }

    @Transactional(readOnly = true)
    public List<Long> requestedIds(int limit) {
        return refunds.requested(PageRequest.of(0, limit));
    }
}
