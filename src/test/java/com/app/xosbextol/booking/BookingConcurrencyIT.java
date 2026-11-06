package com.app.xosbextol.booking;
import com.app.xosbextol.support.PostgresIntegrationSupport;
import com.app.xosbextol.service.impl.JpaBookingService;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.service.impl.JpaVenueService;
import com.app.xosbextol.model.dto.BlockDateRequestDto;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
class BookingConcurrencyIT extends PostgresIntegrationSupport {
    @Autowired JpaBookingService bookings;
    @Autowired JpaVenueService venues;
    @Autowired JdbcTemplate jdbc;
    private long user,owner,hall;
    @BeforeEach void seed() {
        user=jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id",Long.class,"customer-"+String.format("%07d",ThreadLocalRandom.current().nextInt(10_000_000))+"@example.com");
        owner=jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='VENUE_OWNER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id",Long.class,"owner-"+String.format("%07d",ThreadLocalRandom.current().nextInt(10_000_000))+"@example.com");
        long venue=jdbc.queryForObject("insert into venues(owner_id,name,slug,address,latitude,longitude,status_id,created_at,updated_at) values (?,'Test',?,'Baku',40,49,2,now(),now()) returning id",Long.class,owner,UUID.randomUUID().toString());
        hall=jdbc.queryForObject("insert into venue_halls(venue_id,name,capacity_min,capacity_max,price_per_person,active,created_at,updated_at) values (?,'Test',50,500,50,true,now(),now()) returning id",Long.class,venue);
    }
    private CreateBookingRequestDto request() { return new CreateBookingRequestDto(hall,LocalDate.now().plusMonths(3),100,List.of(),null,null); }
    @Test void tenConcurrentRequestsOnlyOneSucceeds() throws Exception {
        var start=new CountDownLatch(1);var successes=new AtomicInteger();
        try(var pool=Executors.newFixedThreadPool(10)) {
            List<Future<?>> work=new ArrayList<>();
            for(int i=0;i<10;i++) {
                String key="parallel-"+i;
                work.add(pool.submit(()->{
                    try { start.await();bookings.create(user,request(),key);successes.incrementAndGet(); }
                    catch(com.app.xosbextol.handler.customExceptions.BusinessException ex) { assertEquals(409,ex.status().value()); }
                    catch(InterruptedException ex) { Thread.currentThread().interrupt();throw new RuntimeException(ex); }
                }));
            }
            start.countDown();for(var f:work) f.get(30,TimeUnit.SECONDS);
        }
        assertEquals(1,successes.get());
        assertEquals(1,jdbc.queryForObject("select count(*) from bookings where hall_id=?",Integer.class,hall));
    }
    @Test void sameDateCanOnlyBeReservedOnceAndCannotBeBlocked() {
        bookings.create(user,request(),"first");
        assertThrows(com.app.xosbextol.handler.customExceptions.BusinessException.class,()->bookings.create(user,request(),"second"));
        assertThrows(com.app.xosbextol.handler.customExceptions.BusinessException.class,()->venues.block(owner,hall,new BlockDateRequestDto(request().getEventDate(),"offline")));
    }
    @Test void ownerCanBlockAndUnblockAFreeDate() {
        var date = LocalDate.now().plusMonths(5);
        long block = venues.block(owner, hall, new BlockDateRequestDto(date, "offline"));
        assertTrue(venues.blocked(hall, date));
        venues.unblock(owner, hall, block);
        assertFalse(venues.blocked(hall, date));
    }
    @Test void userCannotCreateASecondActiveBookingForAnotherDate() {
        bookings.create(user,request(),"active-first");
        var anotherDate = new CreateBookingRequestDto(hall, LocalDate.now().plusMonths(4), 100, List.of(), null, null);
        var error = assertThrows(com.app.xosbextol.handler.customExceptions.BusinessException.class,
                () -> bookings.create(user,anotherDate,"active-second"));
        assertEquals(409,error.status().value());
    }
    @Test void expiryTimestampDoesNotReleaseAnActiveBooking() {
        var first = bookings.create(user,request(),"expired-first");
        jdbc.update("update bookings set expires_at=now()-interval '1 minute' where id=?",first.id());
        var anotherDate = new CreateBookingRequestDto(hall, LocalDate.now().plusMonths(4), 100, List.of(), null, null);
        assertThrows(com.app.xosbextol.handler.customExceptions.BusinessException.class,
                () -> bookings.create(user,anotherDate,"after-expiry"));
    }
    @Test void idempotentReplayAndCancellationReleaseDate() {
        var first=bookings.create(user,request(),"same");
        var second=bookings.create(user,request(),"same");
        assertEquals(first.getId(),second.getId());
        bookings.cancel(user,first.getId(),new CancelBookingRequestDto("Plan changed"));
        var next=bookings.create(user,request(),"new");
        assertNotEquals(first.getId(),next.getId());
    }
    @Test void databaseAlsoRejectsDateOverlapOutsideService() {
        var first=bookings.create(user,request(),"database");
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->jdbc.update(
            "insert into bookings(booking_number,user_id,hall_id,event_date,guest_count,hall_price,total_price,deposit_amount,created_at,updated_at) values ('DIRECT-TEST',?,?,?,100,6000,6000,100,now(),now())",
            user,hall,first.getEventDate()));
    }
    @Test void ownerCannotManageAnotherOwnersHall() {
        assertThrows(com.app.xosbextol.handler.customExceptions.BusinessException.class,()->venues.block(user,hall,new BlockDateRequestDto(request().getEventDate(),"unauthorized")));
    }
}
