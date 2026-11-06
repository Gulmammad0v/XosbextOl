package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.value.BookingPrice;
import com.app.xosbextol.model.value.VenueHallSnapshot;

import com.app.xosbextol.model.value.VenueExtraSnapshot;

import com.app.xosbextol.model.value.BookingSnapshot;

import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.handler.customExceptions.ApiException;
import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.model.event.*;
import com.app.xosbextol.repository.*;
import com.app.xosbextol.service.*;
import com.app.xosbextol.util.Crypto;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class JpaBookingService implements BookingAccess {
    private static final long MIN_CANCELLATION_NOTICE_DAYS = 7;
    @org.springframework.beans.factory.annotation.Value("${app.booking.approval-hours:24}")
    private long approvalHours;
    private final BookingRepository bookings;
    private final UserRepository users;
    private final HallRepository halls;
    private final PromoCodeRepository promoCodes;
    private final ExtraServiceRepository extraServices;
    private final BookingExtraServiceRepository bookingExtraServices;
    private final BookingMenuItemRepository bookingMenuItems;
    private final PaymentRepository payments;
    private final VenueMenuPackageRepository menuPackages;
    private final VenueMenuPackageItemRepository menuPackageItems;
    private final VenueMenuItemRepository menuItems;
    private final VenueAccess venues;
    private final BookingCalendar calendar;
    private final BookingPriceCalculator prices;
    private final BookingStateMachine states;
    private final IdempotencyService idempotency;
    private final AuditService audit;
    private final ApplicationEventPublisher events;
    private final NotificationService notifications;
    private final Clock clock;

    @Override
    @Transactional(readOnly = true)
    public BigDecimal quoteDeposit(long userId, CreateBookingRequestDto request) {
        if (!users.existsById(userId)) throw BusinessException.missing("İstifadəçi");
        if (bookings.existsActiveBooking(userId)) {
            throw BusinessException.conflict("Sizin artıq aktiv rezervasiyanız var. Yeni rezervasiya üçün əvvəlcə mövcud rezervasiyanı ləğv edin");
        }
        if (!request.getEventDate().isAfter(LocalDate.now(clock.withZone(ZoneId.of("Asia/Baku"))))) {
            throw BusinessException.invalid("Tarix gələcəkdə olmalıdır");
        }
        VenueHallSnapshot hall = venues.lockBookableHall(request.getHallId());
        if (request.getGuestCount() < hall.minGuests() || request.getGuestCount() > hall.maxGuests()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BOOKING_GUEST_COUNT_OUT_OF_RANGE",
                    Map.of("min", hall.minGuests(), "max", hall.maxGuests()));
        }
        if (calendar.occupied(hall.id(), request.getEventDate()) || venues.blocked(hall.id(), request.getEventDate())) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOKING_DATE_NOT_AVAILABLE");
        }
        List<VenueExtraSnapshot> selectedExtras = venues.extras(hall.venueId(), safeIds(request.getExtraServiceIds()));
        MenuSelection menu = resolveMenu(hall.venueId(), request);
        VenueHallSnapshot pricedHall = menu.menuPackage() == null ? hall
                : new VenueHallSnapshot(hall.id(), hall.venueId(), hall.ownerId(), hall.minGuests(), hall.maxGuests(),
                    menu.basePerPerson(), hall.depositPercent());
        if (menu.menuPackage() != null && menu.basePerPerson().add(menu.adjustmentPerPerson()).signum() <= 0) {
            throw BusinessException.invalid("Menyu dəyişikliklərindən sonra adam başına qiymət müsbət olmalıdır");
        }
        BigDecimal menuAdjustment = prices.money(menu.adjustmentPerPerson().multiply(BigDecimal.valueOf(request.getGuestCount())));
        BookingPrice before = prices.calculate(pricedHall, request.getGuestCount(), selectedExtras, BigDecimal.ZERO, menuAdjustment);
        PromoCode promo = resolvePromo(request.getPromoCode());
        BigDecimal discount = promo == null ? BigDecimal.ZERO
                : "PERCENT".equals(promo.getDiscountType())
                    ? prices.percentage(before.total(), promo.getDiscountValue())
                    : promo.getDiscountValue();
        return prices.calculate(pricedHall, request.getGuestCount(), selectedExtras, discount, menuAdjustment).deposit();
    }

    @Override
    @Transactional
    public BookingSnapshot createPaid(long userId, CreateBookingRequestDto request, String key, BigDecimal paidAmount) {
        BookingResponseDto response = create(userId, request, key);
        Booking booking = locked(response.id());
        if (paidAmount.compareTo(booking.getDepositAmount()) != 0) {
            throw BusinessException.conflict("Ödəniş məbləği rezerv haqqına uyğun deyil");
        }
        booking.setExpiresAt(null);
        acceptPayment(booking.getId(), paidAmount);
        return snapshot(booking);
    }

    @Transactional
    public BookingResponseDto create(long userId, CreateBookingRequestDto request, String key) {
        String scoped = idempotency.scoped("booking", userId, key);
        String fingerprint = Crypto.sha256(request.toString());
        Optional<Long> previous = idempotency.previous(scoped, fingerprint);
        if (previous.isPresent()) return view(require(previous.get()));
        User user = users.lock(userId).orElseThrow(() -> BusinessException.missing("İstifadəçi"));
        if (bookings.existsActiveBooking(userId)) {
            throw BusinessException.conflict("Sizin artıq aktiv rezervasiyanız var. Yeni rezervasiya üçün əvvəlcə mövcud rezervasiyanı ləğv edin");
        }
        if (!request.getEventDate().isAfter(LocalDate.now(clock.withZone(ZoneId.of("Asia/Baku"))))) {
            throw BusinessException.invalid("Tarix gələcəkdə olmalıdır");
        }
        VenueHallSnapshot hall = venues.lockBookableHall(request.getHallId());
        if (request.getGuestCount() < hall.minGuests() || request.getGuestCount() > hall.maxGuests()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BOOKING_GUEST_COUNT_OUT_OF_RANGE",
                    Map.of("min", hall.minGuests(), "max", hall.maxGuests()));
        }
        if (calendar.occupied(hall.id(), request.getEventDate())
                || venues.blocked(hall.id(), request.getEventDate())) {
            throw new ApiException(HttpStatus.CONFLICT, "BOOKING_DATE_NOT_AVAILABLE");
        }
        List<VenueExtraSnapshot> selectedExtras = venues.extras(hall.venueId(), safeIds(request.getExtraServiceIds()));
        MenuSelection menu = resolveMenu(hall.venueId(), request);
        VenueHallSnapshot pricedHall = menu.menuPackage() == null ? hall
                : new VenueHallSnapshot(hall.id(), hall.venueId(), hall.ownerId(), hall.minGuests(), hall.maxGuests(),
                    menu.basePerPerson(), hall.depositPercent());
        if (menu.menuPackage() != null && menu.basePerPerson().add(menu.adjustmentPerPerson()).signum() <= 0) {
            throw BusinessException.invalid("Menyu dəyişikliklərindən sonra adam başına qiymət müsbət olmalıdır");
        }
        BigDecimal menuAdjustment = prices.money(menu.adjustmentPerPerson().multiply(BigDecimal.valueOf(request.getGuestCount())));
        BookingPrice before = prices.calculate(pricedHall, request.getGuestCount(), selectedExtras, BigDecimal.ZERO, menuAdjustment);
        PromoCode promo = resolvePromo(request.getPromoCode());
        BigDecimal discount = promo == null ? BigDecimal.ZERO
                : "PERCENT".equals(promo.getDiscountType())
                    ? prices.percentage(before.total(), promo.getDiscountValue())
                    : promo.getDiscountValue();
        if (promo != null) promo.setUsedCount(promo.getUsedCount() + 1);
        BookingPrice price = prices.calculate(pricedHall, request.getGuestCount(), selectedExtras, discount, menuAdjustment);

        Booking booking = new Booking();
        booking.setBookingNumber("TY-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT));
        booking.setUser(user);
        booking.setHall(halls.getReferenceById(hall.id()));
        booking.setEventDate(request.getEventDate());
        booking.setGuestCount(request.getGuestCount());
        booking.setEventType(request.getEventType());
        booking.setHallPrice(price.hall());
        booking.setMenuPackage(menu.menuPackage());
        booking.setMenuCustomizationPrice(menuAdjustment);
        booking.setServicesPrice(price.services());
        booking.setDiscountAmount(price.discount());
        booking.setTotalPrice(price.total());
        booking.setDepositAmount(price.deposit());
        booking.setPromoCode(promo);
        booking.setCustomerNote(request.getCustomerNote());
        bookings.saveAndFlush(booking);

        for (VenueExtraSnapshot extra : selectedExtras) {
            int quantity = extra.perPerson() ? request.getGuestCount() : 1;
            BookingExtraService line = new BookingExtraService();
            line.setBooking(booking);
            line.setService(extraServices.getReferenceById(extra.id()));
            line.setQuantity(quantity);
            line.setUnitPrice(extra.price());
            line.setTotalPrice(prices.money(extra.price().multiply(BigDecimal.valueOf(quantity))));
            bookingExtraServices.save(line);
        }
        saveMenuSelections(booking, menu);
        idempotency.remember(scoped, userId, fingerprint, booking.getId());
        audit.record(userId, "BOOKING_CREATED", "BOOKING", booking.getId());
        if (booking.getDepositAmount().signum() == 0) requestApproval(booking);
        return view(booking);
    }

    @Transactional(readOnly = true)
    public BookingResponseDto detail(long userId, long id) {
        Booking booking = require(id);
        if (!Objects.equals(booking.getUserId(), userId)) throw BusinessException.forbidden();
        return view(booking);
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponseDto> mine(long userId, int page, int size) {
        return PageResponse.from(bookings.findByUser_Id(userId, page(page, size)).map(this::view));
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponseDto> adminList(int page, int size) {
        return PageResponse.from(bookings.findAll(page(page, size)).map(this::view));
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponseDto> partner(long owner, long venueId, YearMonth month, Long hallId,
                                                     Long menuPackageId, BookingStatus status, int page, int size) {
        venues.assertOwner(venueId, owner);
        Specification<Booking> filters = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("hall").get("venue").get("id"), venueId));
            if (month != null) {
                predicates.add(builder.between(root.get("eventDate"), month.atDay(1), month.atEndOfMonth()));
            }
            if (hallId != null) {
                predicates.add(builder.equal(root.get("hall").get("id"), hallId));
            }
            if (menuPackageId != null) {
                predicates.add(builder.equal(root.get("menuPackage").get("id"), menuPackageId));
            }
            if (status != null) {
                predicates.add(builder.equal(root.get("statusReference").get("code"), status.name()));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        return PageResponse.from(bookings.findAll(filters, page(page, size)).map(this::view));
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponseDto> partnerPending(long ownerId, int page, int size) {
        Specification<Booking> filters = (root, query, builder) -> builder.and(
                builder.equal(root.get("hall").get("venue").get("owner").get("id"), ownerId),
                builder.equal(root.get("statusReference").get("code"), BookingStatus.PENDING_APPROVAL.name()));
        return PageResponse.from(bookings.findAll(filters, page(page, size)).map(this::view));
    }

    @Transactional(readOnly = true)
    public BookingResponseDto partnerDetail(long ownerId, long id) {
        Booking booking = require(id);
        venues.assertOwner(booking.getHall().getVenue().getId(), ownerId);
        return view(booking);
    }

    @Transactional(readOnly = true)
    public BookingSummaryResponseDto report(long owner, long venueId) {
        return report(owner, venueId, null);
    }

    @Transactional(readOnly = true)
    public BookingSummaryResponseDto report(long owner, long venueId, YearMonth month) {
        venues.assertOwner(venueId, owner);
        Object[] summary = (month == null
                ? bookings.venueSummary(venueId)
                : bookings.venueSummaryBetween(venueId, month.atDay(1), month.atEndOfMonth())).getFirst();
        return new BookingSummaryResponseDto(number(summary[0]).longValue(), number(summary[1]).longValue(),
                decimal(summary[2]), decimal(summary[3]));
    }

    @Transactional
    public BookingResponseDto approve(long ownerId, long id) {
        Booking booking = locked(id);
        long venueId = booking.getHall().getVenue().getId();
        venues.assertOwner(venueId, ownerId);
        if (booking.getStatus() == BookingStatus.CONFIRMED) return view(booking);
        if (booking.getExpiresAt() != null && !booking.getExpiresAt().isAfter(clock.instant())) {
            throw BusinessException.conflict("Rezervasiyanın 24 saatlıq təsdiq müddəti bitib");
        }
        if (booking.getPaidAmount().compareTo(booking.getDepositAmount()) < 0) {
            throw BusinessException.conflict("Depozit ödənilmədən rezervasiyanı təsdiqləmək olmaz");
        }
        states.check(booking.getStatus(), BookingStatus.CONFIRMED);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking.setExpiresAt(null);
        audit.record(ownerId, "BOOKING_APPROVED", "BOOKING", id);
        events.publishEvent(new BookingConfirmedEvent(id, booking.getBookingNumber(), booking.getUserId(), venueId, booking.getEventDate()));
        return view(booking);
    }

    @Transactional
    public BookingResponseDto reject(long ownerId, long id, RejectBookingRequestDto request) {
        Booking booking = locked(id);
        long venueId = booking.getHall().getVenue().getId();
        venues.assertOwner(venueId, ownerId);
        if (booking.getStatus() == BookingStatus.REJECTED) return view(booking);
        states.check(booking.getStatus(), BookingStatus.REJECTED);
        String reason = request.reason() == null ? "" : request.reason().strip();
        if (reason.isEmpty()) throw BusinessException.invalid("İmtina səbəbi məcburidir");
        booking.setStatus(BookingStatus.REJECTED);
        booking.setExpiresAt(null);
        booking.setCancelledAt(clock.instant());
        booking.setCancelReason(reason);
        releasePromo(booking);
        audit.record(ownerId, "BOOKING_REJECTED", "BOOKING", id);
        events.publishEvent(new BookingRejectedEvent(id, booking.getBookingNumber(), booking.getUserId(), booking.getPaidAmount(), reason));
        return view(booking);
    }

    @Transactional
    public BookingResponseDto cancel(long userId, long id, CancelBookingRequestDto request) {
        Booking booking = locked(id);
        if (!Objects.equals(booking.getUserId(), userId)) throw BusinessException.forbidden();
        if (booking.getStatus() == BookingStatus.CANCELLED) return view(booking);
        states.check(booking.getStatus(), BookingStatus.CANCELLED);
        LocalDate cancellationDeadline = booking.getEventDate().minusDays(MIN_CANCELLATION_NOTICE_DAYS);
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Baku")));
        if (today.isAfter(cancellationDeadline)) {
            throw BusinessException.conflict("BOOKING_CANCELLATION_DEADLINE_PASSED");
        }
        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(clock.instant());
        booking.setCancelReason(request.getReason());
        releasePromo(booking);
        audit.record(userId, "BOOKING_CANCELLED", "BOOKING", id);
        events.publishEvent(new BookingCancelledEvent(id, booking.getBookingNumber(), userId,
                booking.getPaidAmount(), booking.getDepositAmount(), request.getReason()));
        return view(booking);
    }

    @Transactional
    public void expire(long id) {
        Booking booking = locked(id);
        if (booking.getStatus() != BookingStatus.PENDING_APPROVAL
                || booking.getExpiresAt() == null || booking.getExpiresAt().isAfter(clock.instant())) return;
        if (booking.getPaidAmount().compareTo(booking.getDepositAmount()) < 0) {
            releasePromo(booking);
            payments.deleteAll(payments.findByBooking_IdOrderById(id));
            bookings.delete(booking);
            audit.record(null, "BOOKING_PAYMENT_TIMEOUT_DELETED", "BOOKING", id);
            return;
        }
        String reason = "Məkan rezervasiyanı 24 saat ərzində təsdiqləmədi";
        states.check(booking.getStatus(), BookingStatus.REJECTED);
        booking.setStatus(BookingStatus.REJECTED);
        booking.setExpiresAt(null);
        booking.setCancelledAt(clock.instant());
        booking.setCancelReason(reason);
        releasePromo(booking);
        audit.record(null, "BOOKING_APPROVAL_TIMEOUT", "BOOKING", id);
        events.publishEvent(new BookingRejectedEvent(id, booking.getBookingNumber(), booking.getUserId(),
                booking.getPaidAmount(), reason));
    }

    @Transactional
    public void complete(long id) {
        Booking booking = locked(id);
        if (booking.getStatus() != BookingStatus.CONFIRMED
                || !booking.getEventDate().isBefore(LocalDate.now(clock.withZone(ZoneId.of("Asia/Baku"))))) return;
        markCompleted(booking, null);
    }

    @Transactional
    public BookingResponseDto complete(long ownerId, long id) {
        Booking booking = locked(id);
        venues.assertOwner(booking.getHall().getVenue().getId(), ownerId);
        if (booking.getStatus() == BookingStatus.COMPLETED) return view(booking);
        if (LocalDate.now(clock.withZone(ZoneId.of("Asia/Baku"))).isBefore(booking.getEventDate())) {
            throw BusinessException.conflict("Tədbiri tarixindən əvvəl tamamlanmış işarələmək olmaz");
        }
        markCompleted(booking, ownerId);
        return view(booking);
    }

    @Transactional
    public void sendReviewPrompt(long id) {
        Booking booking = locked(id);
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Baku")));
        if (booking.getStatus() != BookingStatus.COMPLETED || booking.getReviewPromptSentAt() != null
                || !booking.getEventDate().isBefore(today)) return;
        notifications.localizedWithAction(booking.getUserId(), "REVIEW_REQUEST", "/review/" + booking.getId(),
                booking.getHall().getVenue().getName());
        booking.setReviewPromptSentAt(clock.instant());
        audit.record(null, "REVIEW_PROMPT_SENT", "BOOKING", id);
    }

    @Override @Transactional(readOnly = true)
    public BookingSnapshot get(long id) { return snapshot(require(id)); }

    @Override @Transactional
    public BookingSnapshot lock(long id) { return snapshot(locked(id)); }

    @Override @Transactional
    public void acceptPayment(long id, BigDecimal amount) {
        Booking booking = locked(id);
        if (booking.getStatus() != BookingStatus.PENDING_APPROVAL && booking.getStatus() != BookingStatus.CONFIRMED
                && booking.getStatus() != BookingStatus.COMPLETED) throw BusinessException.conflict("Ödəniş üçün rezervasiya aktiv deyil");
        if (booking.getPaidAmount().add(amount).compareTo(booking.getTotalPrice()) > 0) throw BusinessException.conflict("Ödəniş ümumi məbləği aşır");
        boolean depositWasUnpaid = booking.getStatus() == BookingStatus.PENDING_APPROVAL
                && booking.getPaidAmount().compareTo(booking.getDepositAmount()) < 0;
        booking.setPaidAmount(booking.getPaidAmount().add(amount));
        if (depositWasUnpaid && booking.getPaidAmount().compareTo(booking.getDepositAmount()) >= 0) {
            requestApproval(booking);
        }
    }

    @Override @Transactional
    public void refunded(long id, BigDecimal amount) {
        Booking booking = locked(id);
        if (booking.getStatus() != BookingStatus.CANCELLED && booking.getStatus() != BookingStatus.REJECTED) {
            throw BusinessException.conflict("Yalnız ləğv və ya imtina edilmiş rezervasiya geri qaytarıla bilər");
        }
    }

    @Override @Transactional(readOnly = true)
    public boolean completedBy(long id, long userId) {
        return bookings.findById(id).filter(value -> Objects.equals(value.getUserId(), userId)
                && value.getStatus() == BookingStatus.COMPLETED).isPresent();
    }

    @Transactional(readOnly = true)
    public List<Long> expiredBookingIds(int limit) { return bookings.expired(clock.instant(), PageRequest.of(0, limit)); }

    @Transactional(readOnly = true)
    public List<Long> bookingsReadyToComplete(int limit) {
        return bookings.readyToComplete(LocalDate.now(clock.withZone(ZoneId.of("Asia/Baku"))), PageRequest.of(0, limit));
    }

    @Transactional(readOnly = true)
    public List<Long> bookingsReadyForReviewPrompt(int limit) {
        return bookings.readyForReviewPrompt(LocalDate.now(clock.withZone(ZoneId.of("Asia/Baku"))), PageRequest.of(0, limit));
    }

    private void markCompleted(Booking booking, Long actorId) {
        states.check(booking.getStatus(), BookingStatus.COMPLETED);
        booking.setStatus(BookingStatus.COMPLETED);
        audit.record(actorId, "BOOKING_COMPLETED", "BOOKING", booking.getId());
    }

    private PromoCode resolvePromo(String code) {
        if (code == null || code.isBlank()) return null;
        PromoCode promo = promoCodes.lockByCode(code.toUpperCase(Locale.ROOT))
                .orElseThrow(() -> BusinessException.invalid("Promo kod etibarsızdır"));
        Instant now = clock.instant();
        if (!promo.getActive() || promo.getValidFrom() != null && promo.getValidFrom().isAfter(now)
                || promo.getValidTo() != null && !promo.getValidTo().isAfter(now)
                || promo.getMaxUses() != null && promo.getUsedCount() >= promo.getMaxUses()) {
            throw BusinessException.invalid("Promo kod etibarsızdır");
        }
        return promo;
    }

    private MenuSelection resolveMenu(long venueId, CreateBookingRequestDto request) {
        List<Long> removedIds = safeIds(request.getRemovedMenuItemIds());
        List<Long> addedIds = safeIds(request.getAddedMenuItemIds());
        if (request.getMenuPackageId() == null) {
            if (!removedIds.isEmpty() || !addedIds.isEmpty()) throw BusinessException.invalid("Menyu dəyişiklikləri üçün menyu paketi seçilməlidir");
            return MenuSelection.empty();
        }
        VenueMenuPackage menu = menuPackages.findByIdAndVenue_IdAndActiveTrue(request.getMenuPackageId(), venueId)
                .orElseThrow(() -> BusinessException.invalid("Menyu paketi bu restorana aid deyil"));
        List<VenueMenuItem> included = menuPackageItems.findByMenuPackage_Id(menu.getId()).stream()
                .map(VenueMenuPackageItem::getMenuItem).toList();
        Set<Long> includedIds = included.stream().map(VenueMenuItem::getId).collect(java.util.stream.Collectors.toSet());
        if (!includedIds.containsAll(removedIds)) throw BusinessException.invalid("Yalnız seçilmiş menyudakı yeməyi ləğv etmək olar");
        if (addedIds.stream().anyMatch(includedIds::contains)) throw BusinessException.invalid("Seçilmiş menyuda olan yeməyi yenidən əlavə etmək olmaz");

        List<VenueMenuItem> removed = included.stream().filter(item -> removedIds.contains(item.getId())).toList();
        if (removed.stream().anyMatch(item -> !Boolean.TRUE.equals(item.getCustomizable())))
            throw BusinessException.invalid("Bu məhsulu menyudan çıxarmaq olmaz");
        List<VenueMenuItem> added = addedIds.isEmpty() ? List.of() : menuItems.findByIdInAndCategory_Venue_IdAndActiveTrue(addedIds, venueId);
        if (added.size() != addedIds.size()) throw BusinessException.invalid("Əlavə edilən menyu məhsulu tapılmadı");
        for (VenueMenuItem item : added) {
            if (!Boolean.TRUE.equals(item.getCustomizable()))
                throw BusinessException.invalid("Bu məhsulu başqa menyuya əlavə etmək olmaz");
            if (!menuPackageItems.existsByMenuItem_IdAndMenuPackage_Venue_IdAndMenuPackage_TierGreaterThanAndMenuPackage_ActiveTrue(
                    item.getId(), venueId, menu.getTier())) {
                throw BusinessException.invalid("Yalnız daha bahalı menyudakı məhsulu əlavə etmək olar");
            }
            if (item.getAdditionalPricePerPerson().signum() <= 0) throw BusinessException.invalid("Əlavə məhsulun qiyməti təyin edilməyib");
        }
        BigDecimal base = menu.getPricePerPerson();
        BigDecimal additions = added.stream().map(VenueMenuItem::getAdditionalPricePerPerson).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal deductions = removed.stream().map(VenueMenuItem::getAdditionalPricePerPerson).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new MenuSelection(menu, removed, added, base, additions.subtract(deductions));
    }

    private void saveMenuSelections(Booking booking, MenuSelection selection) {
        for (VenueMenuItem item : selection.removed()) saveMenuSelection(booking, item, BookingMenuItem.Action.REMOVED, item.getAdditionalPricePerPerson());
        for (VenueMenuItem item : selection.added()) saveMenuSelection(booking, item, BookingMenuItem.Action.ADDED, item.getAdditionalPricePerPerson());
    }

    private void saveMenuSelection(Booking booking, VenueMenuItem item, BookingMenuItem.Action action, BigDecimal unitPrice) {
        BookingMenuItem line = new BookingMenuItem();
        line.setBooking(booking);
        line.setMenuItem(item);
        line.setAction(action);
        line.setUnitPrice(prices.money(unitPrice));
        bookingMenuItems.save(line);
        booking.getMenuItems().add(line);
    }

    private List<Long> safeIds(List<Long> values) {
        if (values == null || values.isEmpty()) return List.of();
        LinkedHashSet<Long> unique = new LinkedHashSet<>(values);
        if (unique.size() != values.size()) throw BusinessException.invalid("Eyni seçim bir neçə dəfə göndərilib");
        return List.copyOf(unique);
    }

    private Booking locked(long id) {
        Long hallId = bookings.hallId(id).orElseThrow(() -> BusinessException.missing("Rezervasiya"));
        venues.lockHall(hallId);
        return bookings.lock(id).orElseThrow(() -> BusinessException.missing("Rezervasiya"));
    }

    private Booking require(long id) { return bookings.findById(id).orElseThrow(() -> BusinessException.missing("Rezervasiya")); }

    private BookingSnapshot snapshot(Booking booking) {
        return new BookingSnapshot(booking.getId(), booking.getUserId(), booking.getHallId(), booking.getHall().getVenue().getId(),
                booking.getEventDate(), booking.getStatus().name(), booking.getTotalPrice(), booking.getDepositAmount(),
                booking.getPaidAmount(), booking.getExpiresAt());
    }

    private void requestApproval(Booking booking) {
        booking.setExpiresAt(clock.instant().plus(Duration.ofHours(approvalHours)));
        long ownerId = booking.getHall().getVenue().getOwnerId();
        audit.record(booking.getUserId(), "BOOKING_APPROVAL_REQUESTED", "BOOKING", booking.getId());
        events.publishEvent(new BookingApprovalRequestedEvent(booking.getId(), booking.getBookingNumber(), ownerId,
                booking.getEventDate(), booking.getHall().getName()));
    }

    private void releasePromo(Booking booking) {
        if (booking.getPromoCode() != null) {
            booking.getPromoCode().setUsedCount(Math.max(0, booking.getPromoCode().getUsedCount() - 1));
        }
    }

    private BookingResponseDto view(Booking booking) {
        List<String> removed = booking.getMenuItems().stream().filter(item -> item.getAction() == BookingMenuItem.Action.REMOVED)
                .map(item -> item.getMenuItem().getName()).toList();
        List<String> added = booking.getMenuItems().stream().filter(item -> item.getAction() == BookingMenuItem.Action.ADDED)
                .map(item -> item.getMenuItem().getName()).toList();
        return new BookingResponseDto(booking.getId(), booking.getBookingNumber(), booking.getHallId(), booking.getUserId(),
                booking.getHall().getVenue().getName(), booking.getHall().getName(),
                booking.getHall().getVenue().getOwner().getPhone(),
                booking.getEventDate(), booking.getGuestCount(), booking.getEventType(), booking.getStatus(), booking.getHallPrice(),
                booking.getServicesPrice(), booking.getDiscountAmount(), booking.getTotalPrice(), booking.getDepositAmount(),
                booking.getPaidAmount(), booking.getExpiresAt(), booking.getCustomerNote(),
                booking.getMenuPackage() == null ? null : booking.getMenuPackage().getId(),
                booking.getMenuPackage() == null ? null : booking.getMenuPackage().getName(),
                booking.getMenuCustomizationPrice(), removed, added, selectedMenuView(booking), menuChanges(booking),
                booking.getUser().getFullName(), booking.getUser().getEmail(), booking.getUser().getPhone(),
                booking.getExtraServices().stream().map(line -> new BookingExtraServiceResponseDto(
                        line.getService().getId(), line.getService().getName(), line.getQuantity(),
                        line.getUnitPrice(), line.getTotalPrice())).toList(), booking.getCreatedAt(), booking.getCancelReason());
    }

    private List<BookingMenuChangeResponseDto> menuChanges(Booking booking) {
        return booking.getMenuItems().stream().map(line -> new BookingMenuChangeResponseDto(
                line.getMenuItem().getId(), line.getMenuItem().getName(), line.getMenuItem().getCategory().getName(),
                line.getAction().name(), line.getUnitPrice())).toList();
    }

    private List<MenuCategoryResponseDto> selectedMenuView(Booking booking) {
        if (booking.getMenuPackage() == null) return List.of();
        Set<Long> removed = booking.getMenuItems().stream()
                .filter(line -> line.getAction() == BookingMenuItem.Action.REMOVED)
                .map(line -> line.getMenuItem().getId()).collect(java.util.stream.Collectors.toSet());
        LinkedHashMap<Long, VenueMenuItem> selected = new LinkedHashMap<>();
        menuPackageItems.findDetailedByPackageIds(List.of(booking.getMenuPackage().getId())).stream()
                .map(VenueMenuPackageItem::getMenuItem)
                .filter(item -> !removed.contains(item.getId()))
                .forEach(item -> selected.put(item.getId(), item));
        booking.getMenuItems().stream().filter(line -> line.getAction() == BookingMenuItem.Action.ADDED)
                .map(BookingMenuItem::getMenuItem).forEach(item -> selected.put(item.getId(), item));
        Map<Long, List<VenueMenuItem>> grouped = selected.values().stream()
                .sorted(Comparator.comparing((VenueMenuItem item) -> item.getCategory().getSortOrder()).thenComparing(VenueMenuItem::getId))
                .collect(java.util.stream.Collectors.groupingBy(item -> item.getCategory().getId(), LinkedHashMap::new, java.util.stream.Collectors.toList()));
        return grouped.values().stream().map(items -> {
            VenueMenuCategory category = items.getFirst().getCategory();
            return new MenuCategoryResponseDto(category.getId(), category.getName(), category.getSortOrder(),
                    category.getDefaultCustomizable(), category.getDefaultPricePerPerson(), items.stream()
                    .map(item -> new MenuItemResponseDto(item.getId(), item.getName(), item.getDescription(),
                            Boolean.TRUE.equals(item.getSeasonal()), Boolean.TRUE.equals(item.getCustomizable()),
                            item.getAdditionalPricePerPerson())).toList());
        }).toList();
    }

    private Pageable page(int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw BusinessException.invalid("Səhifə ölçüsü 1–100 olmalıdır");
        return PageRequest.of(page, size, Sort.by("createdAt").descending());
    }

    private Number number(Object value) { return value == null ? 0 : (Number) value; }
    private BigDecimal decimal(Object value) { return value == null ? BigDecimal.ZERO : (BigDecimal) value; }

    @lombok.Value
    @lombok.Builder
    @lombok.extern.jackson.Jacksonized
    @lombok.experimental.Accessors(fluent = true)
    private static class MenuSelection {
        VenueMenuPackage menuPackage;
        List<VenueMenuItem> removed;
        List<VenueMenuItem> added;
        BigDecimal basePerPerson;
        BigDecimal adjustmentPerPerson;

        private static MenuSelection empty() {
                    return new MenuSelection(null, List.of(), List.of(), BigDecimal.ZERO, BigDecimal.ZERO);
                }
    }

}
