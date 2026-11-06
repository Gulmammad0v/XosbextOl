package com.app.xosbextol.payment;
import com.app.xosbextol.support.PostgresIntegrationSupport;
import com.app.xosbextol.service.impl.JpaBookingService;
import com.app.xosbextol.model.dto.CreateBookingRequestDto;
import com.app.xosbextol.model.dto.InitiatePaymentRequestDto;
import com.app.xosbextol.service.impl.PaymentService;
import com.app.xosbextol.client.payment.StubPaymentGateway;
import com.app.xosbextol.client.payment.PaymentGateway;
import com.app.xosbextol.client.payment.PaymentGatewayRequest;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class PaymentInitiationRecoveryIT extends PostgresIntegrationSupport {
    @Autowired JpaBookingService bookings;
    @Autowired PaymentService payments;
    @Autowired JdbcTemplate jdbc;
    @MockitoSpyBean StubPaymentGateway gateway;
    @Test void lostProviderResponseIsRecoveredEvenWhenClientUsesANewKey() {
        String suffix=UUID.randomUUID().toString().substring(0,8);
        long user=jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id",Long.class,"test"+suffix+"@example.com");
        long venue=jdbc.queryForObject("insert into venues(owner_id,name,slug,address,latitude,longitude,status_id,created_at,updated_at) values (?,'Test',?,'Baku',40,49,2,now(),now()) returning id",Long.class,user,UUID.randomUUID().toString());
        long hall=jdbc.queryForObject("insert into venue_halls(venue_id,name,capacity_min,capacity_max,price_per_person,active,created_at,updated_at) values (?,'Test',50,500,50,true,now(),now()) returning id",Long.class,venue);
        var b=bookings.create(user,new CreateBookingRequestDto(hall,LocalDate.now().plusMonths(3),100,List.of(),null,null),"recovery");
        doAnswer(invocation -> {
            invocation.callRealMethod(); // Provider created the session, but its response was lost.
            throw new org.springframework.web.client.ResourceAccessException("lost response");
        }).doCallRealMethod().when(gateway).initiate(any(PaymentGatewayRequest.class));
        var ex=assertThrows(BusinessException.class,()->payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"recover-key"));
        assertEquals(503,ex.status().value());
        assertEquals("INITIATED",jdbc.queryForObject("select s.code from payments p join payment_statuses s on s.id=p.status_id where p.booking_id=?",String.class,b.id()));
        var recovered=payments.initiate(user,new InitiatePaymentRequestDto(b.id()),"new-client-key");
        assertEquals("PENDING",recovered.status());assertNotNull(recovered.checkoutUrl());
        assertEquals(1,jdbc.queryForObject("select count(*) from payments where booking_id=?",Integer.class,b.id()));
    }
}
