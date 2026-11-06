package com.app.xosbextol.repository;
import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import java.util.*;
import java.time.Instant;
public interface PaymentRepository extends JpaRepository<Payment,Long> {
    @Query("select coalesce(sum(case when p.statusReference.code='SUCCESS' then p.amount else 0 end),0), coalesce(sum(case when p.statusReference.code='REFUNDED' then p.amount else 0 end),0) from Payment p")
    List<Object[]> totals();
    Optional<Payment> findByIdempotencyKey(String key);
    Optional<Payment> findFirstByUser_IdAndBookingRequestAndStatusReference_CodeInOrderByIdDesc(
            long userId, String bookingRequest, Collection<String> statuses);
    Optional<Payment> findByProviderAndProviderTxId(String provider,String tx);
    List<Payment> findByBooking_IdOrderById(long bookingId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Payment p where p.id=:id")
    Optional<Payment> lock(long id);
    @Query("select p.id from Payment p where p.statusReference.code in ('INITIATED','PENDING') order by p.id")
    List<Long> unfinished(Pageable page);

    @Query("select p.booking.hall.venue.id, p.booking.hall.venue.name, count(distinct p.booking.id), " +
            "coalesce(sum(p.amount), 0) from Payment p where p.booking is not null " +
            "and p.statusReference.code in ('SUCCESS','REFUNDED') and p.paidAt >= :from and p.paidAt < :to " +
            "group by p.booking.hall.venue.id, p.booking.hall.venue.name order by sum(p.amount) desc")
    List<Object[]> revenueByVenue(Instant from, Instant to);
}
