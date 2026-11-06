package com.app.xosbextol.service.impl;

import com.app.xosbextol.service.PaymentAccess;
import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import com.app.xosbextol.model.dto.InitiatePaymentRequestDto;
import com.app.xosbextol.model.dto.CreateBookingRequestDto;
import com.app.xosbextol.model.dto.PaymentResponseDto;
import com.app.xosbextol.model.dto.PaymentWebhookRequestDto;
import com.app.xosbextol.client.payment.*;
import com.app.xosbextol.repository.*;
import com.app.xosbextol.service.BookingAccess;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.service.impl.IdempotencyService;
import com.app.xosbextol.service.impl.AuditService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;

import java.time.*;
import java.math.BigDecimal;
import java.util.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
@Log4j2
public class PaymentService implements PaymentAccess {
    private final PaymentRepository repo;
    private final BookingAccess bookings;
    private final PaymentGateway gateway;
    private final IdempotencyService idempotency;
    private final AuditService audit;
    private final RefundRepository refunds;
    private final BookingRepository bookingEntities;
    private final UserRepository users;
    private final Clock clock;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
    private final jakarta.persistence.EntityManager entityManager;
    private final org.springframework.transaction.PlatformTransactionManager transactionManager;

    public PaymentResponseDto checkout(long user, CreateBookingRequestDto request, String key) {
        String scoped = idempotency.scoped("booking-checkout", user, key);
        String payload = bookingPayload(request);
        var tx = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        PreparedPayment prepared = Objects.requireNonNull(tx.execute(status -> prepareCheckout(user, request, scoped, payload)));
        if (prepared.response().getCheckoutUrl() != null || !"INITIATED".equals(prepared.response().getStatus())) return prepared.response();
        PaymentGatewaySession session;
        try {
            session = gateway.initiate(new PaymentGatewayRequest(prepared.response().getId(), null,
                    prepared.response().getAmount(), prepared.response().getCurrency(), prepared.providerKey()));
        } catch (RuntimeException ex) {
            log.error("Payment gateway session initiation failed paymentId={}", prepared.response().getId(), ex);
            throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "Ödəniş sessiyası bərpa ediləcək; eyni açarla yenidən sınayın");
        }
        return Objects.requireNonNull(tx.execute(status -> {
            Payment payment = lockedPayment(prepared.response().getId());
            attachSession(payment, session);
            PaymentGatewayResult result = gateway.status(payment.getProviderTxId());
            if (result != null && Set.of("SUCCESS", "FAILED", "CANCELLED").contains(result.status())) apply(payment, result);
            return view(payment);
        }));
    }

    private PreparedPayment prepareCheckout(long user, CreateBookingRequestDto request, String scoped, String payload) {
        Optional<Payment> previous = repo.findByIdempotencyKey(scoped);
        if (previous.isPresent()) {
            Payment payment = previous.get();
            if (!Objects.equals(payment.getUserId(), user) || !Objects.equals(payment.getBookingRequest(), payload)) {
                throw BusinessException.conflict("Açar fərqli rezervasiya üçün istifadə olunub");
            }
            return prepared(payment);
        }
        Optional<Payment> unfinished = repo.findFirstByUser_IdAndBookingRequestAndStatusReference_CodeInOrderByIdDesc(
                user, payload, List.of(PaymentStatus.INITIATED.name(), PaymentStatus.PENDING.name()));
        if (unfinished.isPresent()) return prepared(unfinished.get());
        BigDecimal amount = bookings.quoteDeposit(user, request);
        if (amount.signum() <= 0) throw BusinessException.conflict("Ödəniləcək məbləğ yoxdur");
        Payment payment = new Payment();
        payment.setUser(users.getReferenceById(user));
        payment.setBookingRequest(payload);
        payment.setProvider(gateway.provider());
        payment.setIdempotencyKey(scoped);
        payment.setAmount(amount);
        repo.saveAndFlush(payment);
        audit.record(user, "BOOKING_CHECKOUT_STARTED", "PAYMENT", payment.getId());
        return prepared(payment);
    }

    public PaymentResponseDto initiate(long user, InitiatePaymentRequestDto req, String key) {
        String scoped = idempotency.scoped("payment", user, key);
        var tx = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        PreparedPayment prepared = Objects.requireNonNull(tx.execute(status -> prepare(user, req, scoped)));
        if (prepared.response().getCheckoutUrl() != null || !"INITIATED".equals(prepared.response().getStatus())) return prepared.response();
        PaymentGatewaySession session;
        try {
            session = gateway.initiate(new PaymentGatewayRequest(prepared.response().getId(), prepared.response().getBookingId(),
                    prepared.response().getAmount(), prepared.response().getCurrency(), prepared.providerKey()));
        } catch (RuntimeException ex) {
            log.error("Payment gateway session initiation failed paymentId={}", prepared.response().getId(), ex);
            throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "Ödəniş sessiyası bərpa ediləcək; eyni açarla yenidən sınayın");
        }
        return Objects.requireNonNull(tx.execute(status -> {
            var booking = bookings.lock(prepared.response().getBookingId());
            var payment = lockedPayment(prepared.response().getId());
            attachSession(payment, session);
            if (Set.of("CANCELLED", "REJECTED").contains(booking.status())) {
                var result = gateway.cancel(payment.getProviderTxId());
                if (result != null) apply(payment, result);
            } else {
                var result = gateway.status(payment.getProviderTxId());
                if (result != null && Set.of("SUCCESS", "FAILED", "CANCELLED").contains(result.status())) {
                    apply(payment, result);
                }
            }
            return view(payment);
        }));
    }

    private PreparedPayment prepare(long user, InitiatePaymentRequestDto req, String scoped) {
        var booking = bookings.lock(req.getBookingId());
        if (booking.userId() != user) throw BusinessException.forbidden();
        var previous = repo.findByIdempotencyKey(scoped);
        if (previous.isPresent()) {
            var payment = previous.get();
            if (payment.getBookingId() != req.getBookingId())
                throw BusinessException.conflict("Açar fərqli ödəniş üçün istifadə olunub");
            return prepared(payment);
        }
        var unfinished = repo.findByBooking_IdOrderById(booking.id()).stream()
                .filter(payment -> payment.getStatus() == PaymentStatus.INITIATED || payment.getStatus() == PaymentStatus.PENDING)
                .findFirst();
        if (unfinished.isPresent()) {
            return prepared(unfinished.get());
        }
        if (!"PENDING_APPROVAL".equals(booking.status()) || booking.paid().compareTo(booking.deposit()) >= 0)
            throw BusinessException.conflict("Rezervasiya ödəniş üçün aktiv deyil");
        if (booking.expiresAt() != null && !booking.expiresAt().isAfter(clock.instant()))
            throw BusinessException.conflict("Rezervasiya müddəti bitib");
        if (repo.findByBooking_IdOrderById(booking.id()).stream().anyMatch(p -> p.getStatus() == PaymentStatus.INITIATED || p.getStatus() == PaymentStatus.PENDING))
            throw BusinessException.conflict("Bu rezervasiya üçün ödəniş artıq başladılıb");
        BigDecimal amount = booking.deposit().subtract(booking.paid());
        if (amount.signum() <= 0) throw BusinessException.conflict("Ödəniləcək məbləğ yoxdur");
        Payment p = new Payment();
        p.setBooking(bookingEntities.getReferenceById(booking.id()));
        p.setUser(users.getReferenceById(user));
        p.setProvider(gateway.provider());
        p.setIdempotencyKey(scoped);
        p.setAmount(amount);
        repo.saveAndFlush(p);
        audit.record(user, "PAYMENT_INITIATED", "PAYMENT", p.getId());
        return prepared(p);
    }

    @Transactional(readOnly = true)
    public PaymentResponseDto detail(long user, long id) {
        var p = require(id);
        if (!Objects.equals(p.getUserId(), user)) throw BusinessException.forbidden();
        return view(p);
    }

    @Transactional
    public void webhook(PaymentWebhookRequestDto event) {
        var found = repo.findByProviderAndProviderTxId(event.getProvider(), event.getTransactionId()).orElseThrow(() -> BusinessException.missing("Ödəniş"));
        var p = lockedPayment(found.getId());
        apply(p, new PaymentGatewayResult(event.getTransactionId(), event.getStatus(), event.getAmount(), event.getCurrency()));
    }

    @Transactional
    public void reconcile(long id) {
        var found = require(id);
        var p = lockedPayment(id);
        if (p.getStatus() != PaymentStatus.PENDING && p.getStatus() != PaymentStatus.INITIATED) return;
        if (p.getProviderTxId() == null) recoverSession(p);
        var result = p.getBookingId() != null && Set.of("CANCELLED", "REJECTED").contains(bookings.get(p.getBookingId()).status())
                ? gateway.cancel(p.getProviderTxId()) : gateway.status(p.getProviderTxId());
        if (result != null) apply(p, result);
    }

    @Transactional
    public boolean resolveBeforeExpiry(long bookingId) {
        var booking = bookings.lock(bookingId);
        if (!"PENDING_APPROVAL".equals(booking.status()) || booking.paid().compareTo(booking.deposit()) >= 0) return false;
        boolean safe = true;
        for (var found : repo.findByBooking_IdOrderById(bookingId)) {
            var p = lockedPayment(found.getId());
            if (p.getStatus() == PaymentStatus.SUCCESS) return false;
            if (p.getStatus() == PaymentStatus.INITIATED || p.getStatus() == PaymentStatus.PENDING) {
                if (p.getProviderTxId() == null) recoverSession(p);
                var result = gateway.cancel(p.getProviderTxId());
                if (result == null || !Set.of("SUCCESS", "FAILED", "CANCELLED").contains(result.status())) {
                    safe = false;
                    continue;
                }
                apply(p, result);
                if (p.getStatus() == PaymentStatus.SUCCESS) return false;
            }
        }
        return safe;
    }

    public List<Long> unfinished() {
        return repo.unfinished(PageRequest.of(0, 100));
    }

    private void apply(Payment p, PaymentGatewayResult result) {
        if (!Objects.equals(p.getProviderTxId(), result.transactionId()) || p.getAmount().compareTo(result.amount()) != 0 || !p.getCurrency().equals(result.currency()))
            throw BusinessException.conflict("Ödəniş məbləği, valyutası və ya tranzaksiya uyğun deyil");
        if (p.getStatus() == PaymentStatus.SUCCESS || p.getStatus() == PaymentStatus.REFUNDED) return;
        if ("SUCCESS".equals(result.status())) {
            if (p.getBookingId() == null && p.getBookingRequest() != null) {
                CreateBookingRequestDto request = parseBookingPayload(p.getBookingRequest());
                var booking = bookings.createPaid(p.getUserId(), request, "checkout-payment-" + p.getId(), p.getAmount());
                p.setBooking(bookingEntities.getReferenceById(booking.id()));
                p.setStatus(PaymentStatus.SUCCESS);
                p.setPaidAt(clock.instant());
                audit.record(p.getUserId(), "PAYMENT_SUCCESS", "PAYMENT", p.getId());
                return;
            }
            var booking = bookings.lock(p.getBookingId());
            p.setStatus(PaymentStatus.SUCCESS);
            p.setPaidAt(clock.instant());
            if ("PENDING_APPROVAL".equals(booking.status()) && booking.paid().add(p.getAmount()).compareTo(booking.deposit()) <= 0)
                bookings.acceptPayment(booking.id(), p.getAmount());
            else {
                // A late settlement must never reacquire a date that may have been sold again.
                var refund=new Refund();refund.setPayment(p);refund.setBooking(p.getBooking());refund.setAmount(p.getAmount());
                refund.setReason("Late or duplicate deposit settlement");refunds.save(refund);
            }
            audit.record(booking.userId(), "PAYMENT_SUCCESS", "PAYMENT", p.getId());
        } else if ("FAILED".equals(result.status()) || "CANCELLED".equals(result.status())) {
            p.setStatus(PaymentStatus.valueOf(result.status()));
            audit.record(null, "PAYMENT_" + result.status(), "PAYMENT", p.getId());
        } else if (!"PENDING".equals(result.status()) && !"UNKNOWN".equals(result.status()))
            throw BusinessException.invalid("Gateway statusu yanlışdır");
    }

    private Payment require(long id) {
        return repo.findById(id).orElseThrow(() -> BusinessException.missing("Ödəniş"));
    }

    private void recoverSession(Payment p) {
        attachSession(p, gateway.initiate(new PaymentGatewayRequest(p.getId(), p.getBookingId(), p.getAmount(), p.getCurrency(), p.getIdempotencyKey())));
    }

    private void attachSession(Payment p, PaymentGatewaySession session) {
        if (session == null || session.transactionId() == null || session.checkoutUrl() == null)
            throw new IllegalStateException("Invalid payment session");
        if (p.getProviderTxId() != null && !p.getProviderTxId().equals(session.transactionId()))
            throw BusinessException.conflict("Gateway idempotency müqaviləsini pozdu");
        p.setProviderTxId(session.transactionId());
        p.setCheckoutUrl(session.checkoutUrl());
        if (p.getStatus() == PaymentStatus.INITIATED) p.setStatus(PaymentStatus.PENDING);
    }

    private Payment lockedPayment(long id) {
        var p = repo.lock(id).orElseThrow(() -> BusinessException.missing("Ödəniş"));
        entityManager.refresh(p, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        return p;
    }

    private PaymentResponseDto view(Payment p) {
        return new PaymentResponseDto(p.getId(), p.getBookingId(), p.getProvider(), p.getProviderTxId(), p.getCheckoutUrl(), p.getAmount(), p.getCurrency(), p.getStatus().name());
    }

    private PreparedPayment prepared(Payment payment) {
        return new PreparedPayment(view(payment), payment.getIdempotencyKey());
    }

    @lombok.Value
    @lombok.Builder
    @lombok.extern.jackson.Jacksonized
    @lombok.experimental.Accessors(fluent = true)
    private static class PreparedPayment {
        PaymentResponseDto response;
        String providerKey;
    }

    private String bookingPayload(CreateBookingRequestDto request) {
        try {
            return objectMapper.writeValueAsString(request);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Rezervasiya məlumatları oxuna bilmədi", ex);
        }
    }

    private CreateBookingRequestDto parseBookingPayload(String payload) {
        try {
            return objectMapper.readValue(payload, CreateBookingRequestDto.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Saxlanmış rezervasiya məlumatları oxuna bilmədi", ex);
        }
    }
}
