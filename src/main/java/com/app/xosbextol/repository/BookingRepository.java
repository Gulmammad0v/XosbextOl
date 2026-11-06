package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;

import java.time.*;
import java.util.*;

public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {
    @Query("select b.statusReference.code, count(b) from Booking b group by b.statusReference.code")
    List<Object[]> countByStatus();
    @Query("select b from Booking b where b.hall.id=:hallId and b.eventDate between :from and :to and b.statusReference.code in :statuses")
    List<Booking> findOccupied(long hallId, LocalDate from, LocalDate to, Collection<String> statuses);
    @Query("select distinct b.hall.id from Booking b where b.eventDate=:date and b.statusReference.code in :statuses")
    List<Long> unavailableHallIds(LocalDate date, Collection<String> statuses);
    @Query("select b from Booking b where b.statusReference.code=:status and b.eventDate in :dates")
    List<Booking> findByStatusCodeAndEventDateIn(String status, Collection<LocalDate> dates);
    @Query("select b.hall.id from Booking b where b.id=:id")
    Optional<Long> hallId(long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from Booking b where b.id=:id")
    Optional<Booking> lock(long id);

    Page<Booking> findByUser_Id(long userId, Pageable page);
    @Query("select b from Booking b where b.user.id=:userId and b.hall.venue.id=:venueId " +
            "and b.statusReference.code='COMPLETED' order by b.eventDate desc, b.id desc")
    List<Booking> completedForReview(long userId, long venueId);
    @Query("select count(b) > 0 from Booking b where b.user.id=:userId and " +
            "b.statusReference.code in ('PENDING_APPROVAL','CONFIRMED')")
    boolean existsActiveBooking(long userId);

    @Query("select count(b), sum(case when b.statusReference.code = 'CONFIRMED' then 1 else 0 end), " +
            "coalesce(sum(case when b.statusReference.code in ('CONFIRMED', 'COMPLETED') then b.totalPrice else 0 end), 0), " +
            "coalesce(sum(case when b.statusReference.code in ('CONFIRMED', 'COMPLETED') then b.paidAmount else 0 end), 0) " +
            "from Booking b where b.hall.venue.id = :venueId")
    List<Object[]> venueSummary(long venueId);
    @Query("select count(b), sum(case when b.statusReference.code = 'CONFIRMED' then 1 else 0 end), " +
            "coalesce(sum(case when b.statusReference.code in ('CONFIRMED', 'COMPLETED') then b.totalPrice else 0 end), 0), " +
            "coalesce(sum(case when b.statusReference.code in ('CONFIRMED', 'COMPLETED') then b.paidAmount else 0 end), 0) " +
            "from Booking b where b.hall.venue.id = :venueId and b.eventDate between :from and :to")
    List<Object[]> venueSummaryBetween(long venueId, LocalDate from, LocalDate to);

    @Query("select b.id from Booking b where b.statusReference.code='PENDING_APPROVAL' " +
            "and b.expiresAt is not null and b.expiresAt<=:now order by b.id")
    List<Long> expired(Instant now, Pageable page);

    @Query("select b.id from Booking b where b.statusReference.code='CONFIRMED' and b.eventDate<:today order by b.id")
    List<Long> readyToComplete(LocalDate today, Pageable page);

    @Query("select b.id from Booking b where b.statusReference.code='COMPLETED' and b.eventDate<:today " +
            "and b.reviewPromptSentAt is null order by b.id")
    List<Long> readyForReviewPrompt(LocalDate today, Pageable page);
}
