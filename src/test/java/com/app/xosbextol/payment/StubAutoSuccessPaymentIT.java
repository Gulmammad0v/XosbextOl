package com.app.xosbextol.payment;

import com.app.xosbextol.model.dto.CreateBookingRequestDto;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.service.impl.JpaBookingService;
import com.app.xosbextol.service.impl.PaymentService;
import com.app.xosbextol.support.PostgresIntegrationSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@TestPropertySource(properties = "app.payment.stub-auto-success=true")
class StubAutoSuccessPaymentIT extends PostgresIntegrationSupport {
    @Autowired JpaBookingService bookings;
    @Autowired PaymentService payments;
    @Autowired JdbcTemplate jdbc;

    @Test
    void depositPaymentWaitsForOwnerApprovalInStubMode() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long user = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id",
                Long.class, "customer-" + suffix + "@example.com");
        long owner = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='VENUE_OWNER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id",
                Long.class, "owner-" + suffix + "@example.com");
        long venue = jdbc.queryForObject("insert into venues(owner_id,name,slug,address,latitude,longitude,status_id,created_at,updated_at) values (?,'Test',?,'Baku',40,49,2,now(),now()) returning id",
                Long.class, owner, UUID.randomUUID().toString());
        long hall = jdbc.queryForObject("insert into venue_halls(venue_id,name,capacity_min,capacity_max,price_per_person,active,created_at,updated_at) values (?,'Test',50,500,50,true,now(),now()) returning id",
                Long.class, venue);

        assertEquals(0, jdbc.queryForObject("select count(*) from bookings where user_id=?", Integer.class, user));
        var payment = payments.checkout(user, new CreateBookingRequestDto(
                hall, LocalDate.now().plusMonths(3), 100, List.of(), null, null), "auto-payment");

        assertEquals("SUCCESS", payment.status());
        var awaitingApproval = bookings.detail(user, payment.getBookingId());
        assertEquals("PENDING_APPROVAL", awaitingApproval.status().name());
        assertEquals(0, awaitingApproval.getDepositAmount().compareTo(awaitingApproval.paidAmount()));
        assertEquals("100.00", awaitingApproval.getDepositAmount().toPlainString());
        assertEquals(awaitingApproval.getId(), bookings.partnerDetail(owner, payment.getBookingId()).getId());
        assertThrows(BusinessException.class, () -> bookings.partnerDetail(user, payment.getBookingId()));

        var confirmed = bookings.approve(owner, payment.getBookingId());
        assertEquals("CONFIRMED", confirmed.status().name());
    }
}
