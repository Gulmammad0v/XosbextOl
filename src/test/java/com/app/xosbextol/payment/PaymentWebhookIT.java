package com.app.xosbextol.payment;
import com.app.xosbextol.support.PostgresIntegrationSupport;
import com.app.xosbextol.service.impl.JpaBookingService;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.service.impl.*;
import com.app.xosbextol.util.Crypto;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class PaymentWebhookIT extends PostgresIntegrationSupport {
    @Autowired JpaBookingService bookings;
    @Autowired PaymentService payments;
    @Autowired PaymentWebhookService webhook;
    @Autowired RefundService refunds;
    @Autowired JdbcTemplate jdbc;
    private long user,owner,hall;
    @BeforeEach void seed() {
        String token=UUID.randomUUID().toString().substring(0,8);
        user=jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id",Long.class,"customer-"+token+"@example.com");
        owner=jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='VENUE_OWNER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id",Long.class,"owner-"+token+"@example.com");
        long venue=jdbc.queryForObject("insert into venues(owner_id,name,slug,address,latitude,longitude,status_id,created_at,updated_at) values (?,'Test',?,'Baku',40,49,2,now(),now()) returning id",Long.class,owner,UUID.randomUUID().toString());
        hall=jdbc.queryForObject("insert into venue_halls(venue_id,name,capacity_min,capacity_max,price_per_person,active,created_at,updated_at) values (?,'Test',50,500,50,true,now(),now()) returning id",Long.class,venue);
    }
    private BookingResponseDto booking() { return booking(LocalDate.now(ZoneId.of("Asia/Baku")).plusMonths(3)); }
    private BookingResponseDto booking(LocalDate eventDate) { return bookings.create(user,new CreateBookingRequestDto(hall,eventDate,100,List.of(),null,null),UUID.randomUUID().toString()); }
    private String body(PaymentResponseDto p,String amount) {
        return "{\"provider\":\"stub\",\"transactionId\":\""+p.transactionId()+"\",\"status\":\"SUCCESS\",\"amount\":"+amount+",\"currency\":\"AZN\"}";
    }
    private void deliver(String body) {
        String timestamp=Long.toString(Instant.now().getEpochSecond());
        webhook.handle(Crypto.hmac("test-webhook-secret-xxxxxxxxxx",timestamp+"."+body),timestamp,body);
    }
    @Test void bookingIsCreatedOnlyAfterSuccessfulCheckoutPayment() {
        var request = new CreateBookingRequestDto(hall, LocalDate.now(ZoneId.of("Asia/Baku")).plusMonths(3),
                100, List.of(), null, null);
        var payment = payments.checkout(user, request, "payment-first");
        assertEquals("PENDING", payment.status());
        assertNull(payment.getBookingId());
        assertEquals(0, jdbc.queryForObject("select count(*) from bookings where user_id=?", Integer.class, user));
        var repeated = payments.checkout(user, request, "payment-first-retry");
        assertEquals(payment.id(), repeated.id());
        assertEquals(1, jdbc.queryForObject("select count(*) from payments where user_id=?", Integer.class, user));

        deliver(body(payment, payment.amount().toPlainString()));

        var completedPayment = payments.detail(user, payment.id());
        assertNotNull(completedPayment.getBookingId());
        var booking = bookings.detail(user, completedPayment.getBookingId());
        assertEquals("PENDING_APPROVAL", booking.status().name());
        assertEquals(0, booking.getDepositAmount().compareTo(booking.paidAmount()));
    }
    @Test void repeatedWebhookCreditsOnlyOnceAndWaitsForOwnerApproval() {
        var b=booking();var p=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"deposit");
        deliver(body(p,p.amount().toPlainString()));deliver(body(p,p.amount().toPlainString()));
        var awaitingApproval=bookings.detail(user,b.id());
        assertEquals("PENDING_APPROVAL",awaitingApproval.status().name());assertEquals(0,p.amount().compareTo(awaitingApproval.paidAmount()));
        assertEquals(List.of(b.id()),bookings.partnerPending(owner,0,20).content().stream().map(BookingResponseDto::id).toList());
        assertEquals(0,jdbc.queryForObject("select count(*) from notifications where user_id=? and type='BOOKING_CONFIRMED'",Integer.class,user));
        assertEquals(1,jdbc.queryForObject("select count(*) from notifications where user_id=? and type='BOOKING_APPROVAL_REQUIRED'",Integer.class,owner));

        var confirmed=bookings.approve(owner,b.id());
        assertEquals("CONFIRMED",confirmed.status().name());
        assertTrue(bookings.partnerPending(owner,0,20).content().isEmpty());
        assertEquals(1,jdbc.queryForObject("select count(*) from notifications where user_id=? and type='BOOKING_CONFIRMED'",Integer.class,user));
        assertEquals("Rezervasiya nömrəsi: "+b.getBookingNumber()+", tarix: "+b.getEventDate(),
                jdbc.queryForObject("select body from notifications where user_id=? and type='BOOKING_CONFIRMED'",String.class,user));
    }
    @Test void wrongSignatureAndWrongAmountAreRejected() {
        var b=booking();var p=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"signature");
        assertThrows(BusinessException.class,()->webhook.handle("bad",Long.toString(Instant.now().getEpochSecond()),body(p,"1800")));
        assertThrows(BusinessException.class,()->deliver(body(p,"1")));
        assertEquals("PENDING_APPROVAL",bookings.detail(user,b.id()).status().name());
    }
    @Test void customerCannotCancelWhenEventIsLessThanSevenDaysAway() {
        var b=booking(LocalDate.now(ZoneId.of("Asia/Baku")).plusDays(6));
        var error=assertThrows(BusinessException.class,()->bookings.cancel(user,b.id(),new CancelBookingRequestDto("Plan dəyişdi")));
        assertEquals(409,error.status().value());
        assertEquals("BOOKING_CANCELLATION_DEADLINE_PASSED", error.code());
        assertEquals("PENDING_APPROVAL",bookings.detail(user,b.id()).status().name());
    }
    @Test void customerCanCancelExactlySevenDaysBeforeEvent() {
        var b=booking(LocalDate.now(ZoneId.of("Asia/Baku")).plusDays(7));
        assertEquals("CANCELLED",bookings.cancel(user,b.id(),new CancelBookingRequestDto("Plan dəyişdi")).status().name());
    }
    @Test void cancelledBookingLatePaymentIsRefundedWithoutTakingTheDate() {
        var b=booking();var p=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"late");
        bookings.cancel(user,b.getId(),new CancelBookingRequestDto("Changed"));
        var replacement=booking();deliver(body(p,p.amount().toPlainString()));deliver(body(p,p.amount().toPlainString()));
        assertEquals("CANCELLED",bookings.detail(user,b.id()).status().name());
        assertEquals("PENDING_APPROVAL",bookings.detail(user,replacement.id()).status().name());
        long refund=jdbc.queryForObject("select id from refunds where payment_id=?",Long.class,p.id());
        refunds.process(refund);assertEquals("REFUNDED",payments.detail(user,p.id()).status());
    }
    @Test void confirmedBookingCannotStartAnotherOnlinePaymentAndCancellationKeepsDeposit() {
        var b=booking();var deposit=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"deposit-refund");
        deliver(body(deposit,deposit.amount().toPlainString()));
        bookings.approve(owner,b.id());
        assertThrows(BusinessException.class,()->payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"second-deposit"));
        bookings.cancel(user,b.getId(),new CancelBookingRequestDto("Changed"));
        bookings.cancel(user,b.getId(),new CancelBookingRequestDto("Changed"));
        assertEquals(b.getBookingNumber()+" nömrəli rezervasiyanız ləğv edildi. Depozit geri qaytarılmır.",
                jdbc.queryForObject("select body from notifications where user_id=? and type='BOOKING_CANCELLED' order by id limit 1",String.class,user));
        assertEquals(0,jdbc.queryForObject("select count(*) from refunds where booking_id=?",Integer.class,b.id()));
        assertEquals("CANCELLED",bookings.detail(user,b.id()).status().name());
        assertEquals("SUCCESS",payments.detail(user,deposit.id()).status());
    }
    @Test void concurrentDuplicateWebhooksCreditOnlyOnce() throws Exception {
        var b=booking();var p=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"concurrent");
        var start=new java.util.concurrent.CountDownLatch(1);
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(5)) {
            var futures=new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for(int i=0;i<5;i++) futures.add(pool.submit(()->{
                try { start.await();deliver(body(p,p.amount().toPlainString())); }
                catch(InterruptedException ex) { Thread.currentThread().interrupt();throw new RuntimeException(ex); }
            }));
            start.countDown();for(var f:futures) f.get(30,java.util.concurrent.TimeUnit.SECONDS);
        }
        assertEquals(0,p.amount().compareTo(bookings.detail(user,b.id()).paidAmount()));
    }
    @Test void paymentTimeoutCancelsProviderSessionAndDeletesTemporaryBooking() {
        var b=booking();var p=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"expiry");
        jdbc.update("update bookings set expires_at=now()-interval '1 minute' where id=?",b.id());
        assertTrue(payments.resolveBeforeExpiry(b.id()));bookings.expire(b.id());
        assertThrows(BusinessException.class,()->bookings.detail(user,b.id()));
        assertThrows(BusinessException.class,()->payments.detail(user,p.id()));
        assertNotEquals(b.id(),booking().id());
    }
    @Test void ownerGetsTwentyFourHoursToApproveAndLateApprovalIsRejected() {
        var b=booking();var p=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"approval-window");
        deliver(body(p,p.amount().toPlainString()));
        Instant deadline=jdbc.queryForObject("select expires_at from bookings where id=?",Instant.class,b.id());
        assertNotNull(deadline);
        assertTrue(deadline.isAfter(Instant.now().plus(Duration.ofHours(23))));
        assertTrue(deadline.isBefore(Instant.now().plus(Duration.ofHours(25))));

        jdbc.update("update bookings set expires_at=now()-interval '1 minute' where id=?",b.id());
        assertThrows(BusinessException.class,()->bookings.approve(owner,b.id()));
        bookings.expire(b.id());

        assertEquals("REJECTED",bookings.detail(user,b.id()).status().name());
        assertEquals(1,jdbc.queryForObject("select count(*) from refunds where booking_id=?",Integer.class,b.id()));
    }
    @Test void lateSuccessOfFailedAttemptAfterDepositIsRefunded() {
        var b=booking();var first=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"first-fails");
        deliver(body(first,first.amount().toPlainString()).replace("SUCCESS","FAILED"));
        var second=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"retry-deposit");
        deliver(body(second,second.amount().toPlainString()));
        deliver(body(first,first.amount().toPlainString()));
        assertEquals(0,b.getDepositAmount().compareTo(bookings.detail(user,b.id()).paidAmount()));
        assertEquals(1,jdbc.queryForObject("select count(*) from refunds where payment_id=?",Integer.class,first.id()));
        assertEquals("PENDING_APPROVAL",bookings.detail(user,b.id()).status().name());
    }
    @Test void ownerRejectionRequiresReasonNotifiesCustomerAndRefundsFullDeposit() {
        var b=booking();var deposit=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"owner-rejects");
        deliver(body(deposit,deposit.amount().toPlainString()));

        String reason="Həmin tarix restoranda artıq doludur";
        var rejected=bookings.reject(owner,b.id(),new RejectBookingRequestDto(reason));
        assertEquals("REJECTED",rejected.status().name());
        assertEquals(reason,rejected.getCancelReason());
        assertEquals(1,jdbc.queryForObject("select count(*) from refunds where booking_id=?",Integer.class,b.id()));
        assertEquals(0,deposit.amount().compareTo(jdbc.queryForObject("select amount from refunds where booking_id=?",java.math.BigDecimal.class,b.id())));
        assertEquals(1,jdbc.queryForObject("select count(*) from notifications where user_id=? and type='BOOKING_REJECTED'",Integer.class,user));
        assertTrue(jdbc.queryForObject("select body from notifications where user_id=? and type='BOOKING_REJECTED'",String.class,user).contains(reason));

        long refundId=jdbc.queryForObject("select id from refunds where booking_id=?",Long.class,b.id());
        refunds.process(refundId);
        assertEquals("REJECTED",bookings.detail(user,b.id()).status().name());
        assertEquals("REFUNDED",payments.detail(user,deposit.id()).status());
    }
}
