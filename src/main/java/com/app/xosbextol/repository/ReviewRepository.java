package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    Page<Review> findByVenue_IdAndStatus(long venueId, String status, Pageable pageable);
    Page<Review> findByModerationStatusOrderByReportedAtAsc(String moderationStatus, Pageable pageable);
    Optional<Review> findByBooking_Id(long bookingId);
    boolean existsByBooking_Id(long bookingId);
    @Query("select coalesce(avg(r.rating), 0), count(r) from Review r where r.venue.id = :venueId and r.status = 'VISIBLE'")
    List<Object[]> visibleRatingSummary(long venueId);
    @Query("select coalesce(avg(r.rating), 0), avg(r.ratingFood), " +
            "avg(r.ratingService), avg(r.ratingHall), " +
            "avg(r.ratingValue), count(r) from Review r " +
            "where r.venue.id = :venueId and r.status = 'VISIBLE'")
    List<Object[]> visibleDetailedRatingSummary(long venueId);
    @Query("select r.rating, count(r) from Review r where r.venue.id = :venueId and r.status = 'VISIBLE' group by r.rating")
    List<Object[]> visibleRatingDistribution(long venueId);
}
