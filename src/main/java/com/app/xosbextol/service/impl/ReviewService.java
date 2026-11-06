package com.app.xosbextol.service.impl;

import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.model.entity.Booking;
import com.app.xosbextol.model.enums.BookingStatus;
import com.app.xosbextol.model.entity.Review;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.repository.*;
import com.app.xosbextol.service.VenueAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReviewService {
    private static final ZoneId BAKU = ZoneId.of("Asia/Baku");
    private static final Duration EDIT_WINDOW = Duration.ofDays(7);

    private final ReviewRepository reviews;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final VenueRepository venueRepository;
    private final VenueMediaRepository venueMediaRepository;
    private final VenueAccess venues;
    private final AuditService audit;
    private final NotificationService notifications;
    private final Clock clock;

    @Value("${app.review.open-after-days:1}")
    private long openAfterDays;
    @Value("${app.review.window-days:60}")
    private long reviewWindowDays;

    @Transactional
    public long create(long userId, CreateReviewRequestDto request) {
        Booking booking = lockOwnedBooking(request.getBookingId(), userId);
        assertCanCreate(booking);
        if (reviews.existsByBooking_Id(booking.getId())) {
            throw BusinessException.conflict("Bu rezervasiya üçün artıq rəy yazılıb");
        }

        Review review = new Review();
        review.setBooking(booking);
        review.setUser(userRepository.getReferenceById(userId));
        review.setVenue(venueRepository.getReferenceById(booking.getHall().getVenue().getId()));
        apply(review, request.getRating(), request.getRatingFood(), request.getRatingService(),
                request.getRatingHall(), request.getRatingValue(), request.getComment());
        Long id = reviews.saveAndFlush(review).getId();
        venues.updateRating(review.getVenue().getId());
        audit.record(userId, "REVIEW_CREATED", "REVIEW", id);
        return id;
    }

    @Transactional
    public void update(long userId, long id, UpdateReviewRequestDto request) {
        Review review = ownedReview(id, userId);
        if (clock.instant().isAfter(review.getCreatedAt().plus(EDIT_WINDOW))) {
            throw BusinessException.conflict("Rəyi yalnız ilk 7 gün ərzində redaktə etmək olar");
        }
        apply(review, request.getRating(), request.getRatingFood(), request.getRatingService(),
                request.getRatingHall(), request.getRatingValue(), request.getComment());
        review.setEditedAt(clock.instant());
        venues.updateRating(review.getVenue().getId());
        audit.record(userId, "REVIEW_EDITED", "REVIEW", id);
    }

    @Transactional(readOnly = true)
    public ReviewEligibilityResponseDto eligibility(long userId, long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> BusinessException.missing("Rezervasiya"));
        if (!Objects.equals(booking.getUserId(), userId)) throw BusinessException.forbidden();
        return eligibility(booking);
    }

    @Transactional(readOnly = true)
    public Optional<ReviewEligibilityResponseDto> venueEligibility(long userId, long venueId) {
        return bookingRepository.completedForReview(userId, venueId).stream()
                .map(this::eligibility)
                .filter(item -> item.eligible() || item.editable())
                .findFirst();
    }

    private ReviewEligibilityResponseDto eligibility(Booking booking) {
        Review review = reviews.findByBooking_Id(booking.getId()).orElse(null);
        LocalDate opensOn = booking.getEventDate().plusDays(openAfterDays);
        LocalDate closesOn = opensOn.plusDays(reviewWindowDays);
        LocalDate today = LocalDate.now(clock.withZone(BAKU));
        boolean eligible = review == null && booking.getStatus() == BookingStatus.COMPLETED
                && !today.isBefore(opensOn) && !today.isAfter(closesOn);
        boolean editable = review != null && !clock.instant().isAfter(review.getCreatedAt().plus(EDIT_WINDOW));
        long venueId = booking.getHall().getVenue().getId();
        String coverImageUrl = venueMediaRepository.findFirstByVenue_IdAndHallIsNullAndTypeOrderBySortOrderAscIdAsc(venueId, "IMAGE")
                .map(media -> media.getThumbUrl() == null ? media.getUrl() : media.getThumbUrl()).orElse(null);
        return new ReviewEligibilityResponseDto(booking.getId(), venueId,
                booking.getHall().getVenue().getName(), coverImageUrl, booking.getEventDate(), booking.getGuestCount(), eligible,
                opensOn, closesOn, editable, review == null ? null : review.getCreatedAt().plus(EDIT_WINDOW),
                review == null ? null : response(review));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(long venueId, int page, int size) {
        validatePage(page, size);
        var result = reviews.findByVenue_IdAndStatus(venueId, "VISIBLE",
                PageRequest.of(page, size, Sort.by("createdAt").descending().and(Sort.by("id").descending())));
        Object[] totals = reviews.visibleDetailedRatingSummary(venueId).getFirst();
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int rating = 5; rating >= 1; rating--) distribution.put(rating, 0L);
        for (Object[] row : reviews.visibleRatingDistribution(venueId)) {
            distribution.put(((Number) row[0]).intValue(), ((Number) row[1]).longValue());
        }
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("ratingAvg", decimal(totals[0]));
        summary.put("ratingFood", nullableDecimal(totals[1]));
        summary.put("ratingService", nullableDecimal(totals[2]));
        summary.put("ratingHall", nullableDecimal(totals[3]));
        summary.put("ratingValue", nullableDecimal(totals[4]));
        summary.put("count", ((Number) totals[5]).longValue());
        summary.put("distribution", distribution);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", result.getContent().stream().map(this::response).toList());
        response.put("page", page);
        response.put("size", size);
        response.put("totalElements", result.getTotalElements());
        response.put("totalPages", result.getTotalPages());
        response.put("summary", summary);
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> reported(int page, int size) {
        validatePage(page, size);
        var result = reviews.findByModerationStatusOrderByReportedAtAsc("PENDING", PageRequest.of(page, size));
        return Map.of("content", result.getContent().stream().map(review -> new ReportedReviewResponseDto(
                        response(review), review.getVenue().getId(), review.getVenue().getName(),
                        review.getReportReason(), review.getReportedAt())).toList(),
                "page", page, "size", size, "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages());
    }

    @Transactional
    public void reply(long ownerId, long id, ReviewReplyRequestDto request) {
        Review review = require(id);
        venues.assertOwner(review.getVenue().getId(), ownerId);
        review.setOwnerReply(request.getText().strip());
        audit.record(ownerId, "REVIEW_REPLY", "REVIEW", id);
    }

    @Transactional
    public void report(long ownerId, long id, ReviewReportRequestDto request) {
        Review review = require(id);
        venues.assertOwner(review.getVenue().getId(), ownerId);
        if ("PENDING".equals(review.getModerationStatus())) {
            throw BusinessException.conflict("Bu rəy artıq moderasiyaya göndərilib");
        }
        review.setReportedAt(clock.instant());
        review.setReportReason(request.reason().strip());
        review.setModerationStatus("PENDING");
        audit.record(ownerId, "REVIEW_REPORTED", "REVIEW", id);
        notifications.enqueueForActiveAdmins(
                "REVIEW_REPORTED",
                "Yeni rəy şikayəti",
                review.getVenue().getName() + " məkanı bir rəydən şikayət etdi. Səbəb: " + review.getReportReason(),
                "/admin/reviewReports"
        );
    }

    @Transactional
    public void moderate(long adminId, long id, ReviewModerationRequestDto request) {
        Review review = require(id);
        long venueId = review.getVenue().getId();
        review.setStatus(request.getStatus());
        review.setModerationStatus("HIDDEN".equals(request.getStatus()) ? "ACTION_TAKEN" : "DISMISSED");
        venues.updateRating(venueId);
        audit.record(adminId, "REVIEW_MODERATED", "REVIEW", id);
    }

    private Booking lockOwnedBooking(long bookingId, long userId) {
        Booking booking = bookingRepository.lock(bookingId)
                .orElseThrow(() -> BusinessException.missing("Rezervasiya"));
        if (!Objects.equals(booking.getUserId(), userId)) throw BusinessException.forbidden();
        return booking;
    }

    private void assertCanCreate(Booking booking) {
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw BusinessException.conflict("Yalnız tamamlanmış tədbir üçün rəy yazmaq olar");
        }
        LocalDate today = LocalDate.now(clock.withZone(BAKU));
        LocalDate opensOn = booking.getEventDate().plusDays(openAfterDays);
        LocalDate closesOn = opensOn.plusDays(reviewWindowDays);
        if (today.isBefore(opensOn)) {
            throw BusinessException.conflict("Rəy tədbirdən 1 gün sonra açıla bilər");
        }
        if (today.isAfter(closesOn)) {
            throw BusinessException.conflict("Rəy yazmaq üçün 60 günlük müddət bitib");
        }
    }

    private Review ownedReview(long id, long userId) {
        Review review = require(id);
        if (!Objects.equals(review.getUser().getId(), userId)) throw BusinessException.forbidden();
        return review;
    }

    private Review require(long id) {
        return reviews.findById(id).orElseThrow(() -> BusinessException.missing("Rəy"));
    }

    private void apply(Review review, int rating, Integer food, Integer service, Integer hall,
                       Integer value, String comment) {
        review.setRating((short) rating);
        review.setRatingFood(shortValue(food));
        review.setRatingService(shortValue(service));
        review.setRatingHall(shortValue(hall));
        review.setRatingValue(shortValue(value));
        review.setComment(comment == null || comment.isBlank() ? null : comment.strip());
    }

    private Short shortValue(Integer value) {
        return value == null ? null : value.shortValue();
    }

    private Integer integer(Short value) {
        return value == null ? null : value.intValue();
    }

    private BigDecimal decimal(Object value) {
        return BigDecimal.valueOf(((Number) value).doubleValue()).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal nullableDecimal(Object value) {
        return value == null ? null : decimal(value);
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw BusinessException.invalid("Səhifə ölçüsü 1–100 olmalıdır");
        }
    }

    private ReviewResponseDto response(Review review) {
        String userName = review.getUser().getFullName();
        if (userName == null || userName.isBlank()) userName = "Müştəri";
        else {
            String[] parts = userName.strip().split("\\s+");
            if (parts.length > 1) userName = parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
        }
        return new ReviewResponseDto(review.getId(), review.getBooking().getId(), userName,
                review.getRating(), integer(review.getRatingFood()), integer(review.getRatingService()),
                integer(review.getRatingHall()), integer(review.getRatingValue()), review.getComment(),
                review.getOwnerReply(), review.getStatus(), review.getModerationStatus(),
                review.getCreatedAt(), review.getEditedAt());
    }
}
