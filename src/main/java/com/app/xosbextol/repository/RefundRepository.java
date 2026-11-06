package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.Refund;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.time.Instant;

public interface RefundRepository extends JpaRepository<Refund, Long> {
    long countByStatus(String status);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select r from Refund r join fetch r.payment where r.id = :id")
    Optional<Refund> lock(long id);
    boolean existsByPayment_Id(long paymentId);
    @Query("select coalesce(sum(r.amount), 0) from Refund r where r.booking.id = :bookingId and r.status = 'PROCESSED'")
    BigDecimal processedTotal(long bookingId);
    @Query("select r.id from Refund r where r.status = 'REQUESTED' order by r.id")
    List<Long> requested(Pageable pageable);

    @Query("select r.booking.hall.venue.id, r.booking.hall.venue.name, coalesce(sum(r.amount), 0) " +
            "from Refund r where r.status = 'PROCESSED' and r.processedAt >= :from and r.processedAt < :to " +
            "group by r.booking.hall.venue.id, r.booking.hall.venue.name")
    List<Object[]> processedByVenue(Instant from, Instant to);
}
