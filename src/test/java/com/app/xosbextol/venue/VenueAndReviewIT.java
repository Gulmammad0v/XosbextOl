package com.app.xosbextol.venue;

import com.app.xosbextol.support.PostgresIntegrationSupport;
import com.app.xosbextol.service.impl.JpaVenueService;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.model.enums.VenueStatus;
import com.app.xosbextol.service.impl.ReviewService;
import com.app.xosbextol.service.impl.JpaBookingService;
import com.app.xosbextol.service.impl.StatsService;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class VenueAndReviewIT extends PostgresIntegrationSupport {
    @Autowired
    JpaVenueService venues;
    @Autowired
    ReviewService reviews;
    @Autowired
    JpaBookingService bookings;
    @Autowired
    StatsService stats;
    @Autowired
    JdbcTemplate jdbc;


    @Test
    void duplicateRequestedSlugGetsAUniqueSuffix() {
        String suffix = UUID.randomUUID().toString();
        long owner = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='VENUE_OWNER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class, "slug-owner-" + suffix + "@example.com");
        String requestedSlug = "test-venue-" + suffix;

        var first = venues.create(owner, new VenueRequestDto("Birinci məkan", requestedSlug, null,
                "Birinci ünvan " + suffix, "Bakı", new BigDecimal("40.4"), new BigDecimal("49.8")));
        var second = venues.create(owner, new VenueRequestDto("İkinci məkan", requestedSlug, null,
                "İkinci ünvan " + suffix, "Bakı", new BigDecimal("40.5"), new BigDecimal("49.9")));

        assertEquals(requestedSlug, first.getSlug());
        assertEquals(requestedSlug + "-2", second.getSlug());
    }

    @Test
    void newVenueReceivesStandardMenuAndServiceChoicesAndMenuCanBeDeleted() {
        String suffix = UUID.randomUUID().toString();
        long owner = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='VENUE_OWNER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class, "template-owner-" + suffix + "@example.com");
        var venue = venues.create(owner, new VenueRequestDto("Şablon məkanı", "template-" + suffix, null,
                "Şablon ünvanı " + suffix, "Bakı", new BigDecimal("40.4"), new BigDecimal("49.8")));

        var detail = venues.ownedDetail(owner, venue.getId());
        assertEquals(1, detail.getMenus().size());
        assertEquals("Standart toy menyusu", detail.getMenus().getFirst().getName());
        assertEquals(6, detail.getMenus().getFirst().getCategories().size());
        assertEquals(39, detail.getMenus().getFirst().getCategories().stream().mapToInt(category -> category.getItems().size()).sum());
        assertEquals(Set.of("Musiqi", "Video çəkilişi", "Zər yağışı"),
                detail.getServices().stream().map(ExtraServiceResponseDto::getName).collect(java.util.stream.Collectors.toSet()));
        assertTrue(detail.getServices().stream().noneMatch(ExtraServiceResponseDto::isActive));

        venues.deleteMenu(owner, venue.getId(), detail.getMenus().getFirst().getId());

        assertTrue(venues.ownedDetail(owner, venue.getId()).getMenus().isEmpty());
        assertFalse(venues.onboarding(owner, venue.getId()).requirements().stream()
                .filter(requirement -> requirement.code().equals("MENU")).findFirst().orElseThrow().complete());
    }

    @Test
    void hallPriceIsOptionalAndDefaultsToZero() {
        String suffix = UUID.randomUUID().toString();
        long owner = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='VENUE_OWNER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class, "hall-owner-" + suffix + "@example.com");
        var venue = venues.create(owner, new VenueRequestDto("Qiymətsiz zal", "hall-without-price-" + suffix, null,
                "Zal ünvanı " + suffix, "Bakı", new BigDecimal("40.4"), new BigDecimal("49.8")));

        var hall = venues.addHall(owner, venue.getId(),
                new HallRequestDto("Əsas zal", 50, 500, null, BigDecimal.ONE, true));

        assertEquals(0, BigDecimal.ZERO.compareTo(hall.getPricePerPerson()));
    }

    @Test
    void venueApprovalCacheAndReviewEligibility() {
        String random = UUID.randomUUID().toString();
        String suffix = String.format("%07d", java.util.concurrent.ThreadLocalRandom.current().nextInt(10_000_000));
        long owner = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='VENUE_OWNER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class, "owner-" + suffix + "@example.com");
        long user = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='CUSTOMER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class, "customer-" + suffix + "@example.com");
        long admin = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='ADMIN'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class, "admin-" + suffix + "@example.com");
        var v = venues.create(owner, new VenueRequestDto("Test", random, null, "Baku " + random, "Bakı", new BigDecimal("40"), new BigDecimal("49")));
        assertThrows(BusinessException.class, () -> venues.detail(v.getId()));
        var h = venues.addHall(owner, v.getId(), new HallRequestDto("Main", 50, 500, new BigDecimal("50"), new BigDecimal("30"), true));
        for (int i = 0; i < 5; i++)
            venues.addMedia(owner, v.getId(), new VenueMediaRequestDto(null, "IMAGE", "https://example.com/" + random + "/" + i, null, i));
        venues.addMedia(owner, v.getId(), new VenueMediaRequestDto(h.getId(), "IMAGE", "https://example.com/" + random + "/hall", null, 0));
        var savedMenu = venues.saveMenu(owner, v.getId(), null, new MenuPackageRequestDto("Standard", null,
                new BigDecimal("50"), 1, true, true, List.of(new MenuCategoryRequestDto("İsti yeməklər", 1,
                List.of(new MenuItemRequestDto("Qara kürü testi", null, false, false, BigDecimal.ZERO),
                        new MenuItemRequestDto("Qırmızı kürü testi", null, false, false, BigDecimal.ZERO),
                        new MenuItemRequestDto("Saxlanılan məhsul", null, false, false, BigDecimal.ZERO))))));
        assertTrue(savedMenu.getCategories().getFirst().getItems().stream().anyMatch(item -> item.getName().equals("Qara kürü testi")));
        venues.saveLegal(owner, v.getId(), new VenueLegalRequestDto("Test MMC", "1234567890", "ABC1234", "https://example.com/company", "https://example.com/identity"));
        venues.acceptAgreement(owner, v.getId(), new AgreementAcceptanceRequestDto(true, JpaVenueService.TEST_AGREEMENT_VERSION));
        venues.decision(owner, v.getId(), new VenueDecisionRequestDto(VenueStatus.ACTIVE, null));
        assertEquals(VenueStatus.ACTIVE, venues.detail(v.getId()).getVenue().getStatus());
        assertEquals(VenueStatus.ACTIVE, venues.detail(v.getId()).getVenue().getStatus()); // Redis deserialization.
        assertThrows(BusinessException.class, () -> venues.saveLegal(owner, v.getId(),
                new VenueLegalRequestDto("Changed MMC", "1234567890", "ABC1234", "https://example.com/company",
                        "https://example.com/identity")));

        var requestedCompanyEdit = venues.requestCompanyEdit(owner, v.getId(),
                new CompanyEditRequestDto("Hüquqi ad dəyişib."));
        assertEquals("REQUESTED", requestedCompanyEdit.companyEditStatus());
        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where user_id=? and type='COMPANY_EDIT_REQUEST'", Integer.class, admin));
        var approvedCompanyEdit = venues.decideCompanyEdit(admin, v.getId(),
                new CompanyEditDecisionRequestDto(true, null));
        assertEquals("APPROVED", approvedCompanyEdit.companyEditStatus());
        assertNotNull(approvedCompanyEdit.companyEditAllowedUntil());
        venues.saveLegal(owner, v.getId(), new VenueLegalRequestDto("Changed MMC", "1234567890", "ABC1234",
                "https://example.com/company-new", "https://example.com/identity"));
        var pendingCompanyEdit = venues.onboarding(owner, v.getId());
        assertEquals(VenueStatus.PENDING, pendingCompanyEdit.status());
        assertEquals("CHANGES_PENDING", pendingCompanyEdit.companyEditStatus());
        assertTrue(pendingCompanyEdit.changes().stream().anyMatch(change -> change.section().equals("Şirkət məlumatları")
                && change.field().equals("Hüquqi ad") && change.oldValue().equals("Test MMC") && change.newValue().equals("Changed MMC")));
        assertThrows(BusinessException.class, () -> venues.saveLegal(owner, v.getId(),
                new VenueLegalRequestDto("Second change", "1234567890", "ABC1234", "https://example.com/company-new",
                        "https://example.com/identity")));
        venues.decision(admin, v.getId(), new VenueDecisionRequestDto(VenueStatus.ACTIVE, null));
        assertEquals("REVIEW_APPROVED", venues.onboarding(owner, v.getId()).companyEditStatus());
        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where user_id=? and type='VENUE_CHANGE_APPROVED'", Integer.class, owner));

        venues.updateHall(owner, h.getId(), new HallRequestDto("Updated hall", 50, 500,
                new BigDecimal("55"), new BigDecimal("30"), true));
        var pendingChange = venues.onboarding(owner, v.getId());
        assertEquals(VenueStatus.PENDING, pendingChange.status());
        assertEquals("REAPPROVAL_PENDING", pendingChange.criticalChangeStatus());
        assertTrue(pendingChange.changes().stream().anyMatch(change -> change.section().equals("Zallar")
                && change.field().contains("ad") && change.oldValue().equals("Main") && change.newValue().equals("Updated hall")));
        assertEquals("Updated hall", venues.adminDetail(v.getId()).getHalls().getFirst().getName());
        assertThrows(BusinessException.class, () -> venues.detail(v.getId()));

        String rejectionReason = "Zal qiymətini əsaslandırın";
        venues.decision(owner, v.getId(), new VenueDecisionRequestDto(VenueStatus.REJECTED, rejectionReason));
        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where user_id=? and type='VENUE_CHANGE_REJECTED'", Integer.class, owner));
        assertTrue(jdbc.queryForObject("select body from notifications where user_id=? and type='VENUE_CHANGE_REJECTED'", String.class, owner).contains(rejectionReason));

        venues.updateHall(owner, h.getId(), new HallRequestDto("Approved hall", 50, 500,
                new BigDecimal("55"), new BigDecimal("30"), true));
        venues.decision(owner, v.getId(), new VenueDecisionRequestDto(VenueStatus.ACTIVE, null));
        assertEquals(VenueStatus.ACTIVE, venues.detail(v.getId()).getVenue().getStatus());
        assertEquals("REAPPROVAL_APPROVED", venues.detail(v.getId()).getVenue().getChangeReviewStatus());
        assertEquals(2, jdbc.queryForObject("select count(*) from notifications where user_id=? and type='VENUE_CHANGE_APPROVED'", Integer.class, owner));

        venues.saveMenu(owner, v.getId(), savedMenu.getId(), new MenuPackageRequestDto("Standard", null,
                new BigDecimal("50"), 1, true, true, List.of(new MenuCategoryRequestDto("İsti yeməklər", 1,
                List.of(new MenuItemRequestDto("Qara kürü testi", null, false, true, new BigDecimal("6")),
                        new MenuItemRequestDto("Qırmızı kürü testi", null, false, false, BigDecimal.ZERO),
                        new MenuItemRequestDto("Saxlanılan məhsul", null, false, false, BigDecimal.ZERO))))));
        var menuChange = venues.onboarding(owner, v.getId());
        assertEquals(2, menuChange.changes().size(), menuChange.changes().toString());
        assertTrue(menuChange.changes().stream().allMatch(change -> change.section().equals("Menyular")
                && change.field().contains("Qara kürü testi")));
        assertTrue(menuChange.changes().stream().anyMatch(change -> change.field().contains("dəyişdirilə bilər")
                && change.oldValue().equals("Xeyr") && change.newValue().equals("Bəli")));
        assertTrue(menuChange.changes().stream().anyMatch(change -> change.field().contains("dəyişiklik qiyməti")
                && change.oldValue().equals("0.00 AZN") && change.newValue().equals("6.00 AZN")));
        venues.decision(owner, v.getId(), new VenueDecisionRequestDto(VenueStatus.ACTIVE, null));

        venues.saveMenu(owner, v.getId(), savedMenu.getId(), new MenuPackageRequestDto("Standard", null,
                new BigDecimal("50"), 1, true, true, List.of(new MenuCategoryRequestDto("İsti yeməklər", 1,
                List.of(new MenuItemRequestDto("Saxlanılan məhsul", null, false, false, BigDecimal.ZERO),
                        new MenuItemRequestDto("Hinduşka kababı testi", null, false, false, BigDecimal.ZERO))))));
        venues.addExtra(owner, v.getId(), new ExtraServiceRequestDto("Müğənni xidməti", "Yarım saat çıxış", new BigDecimal("500"), "FIXED", true));
        var collectionChanges = venues.onboarding(owner, v.getId()).changes();
        assertEquals(4, collectionChanges.size(), collectionChanges.toString());
        assertTrue(collectionChanges.stream().anyMatch(change -> change.changeType().equals("REMOVED")
                && change.field().contains("Qara kürü testi") && change.field().endsWith("məhsul")));
        assertTrue(collectionChanges.stream().anyMatch(change -> change.changeType().equals("REMOVED")
                && change.field().contains("Qırmızı kürü testi") && change.field().endsWith("məhsul")));
        assertTrue(collectionChanges.stream().anyMatch(change -> change.changeType().equals("ADDED")
                && change.field().contains("Hinduşka kababı testi") && change.field().endsWith("məhsul")));
        assertTrue(collectionChanges.stream().anyMatch(change -> change.changeType().equals("ADDED")
                && change.section().equals("Əlavə xidmətlər") && change.newValue().contains("Müğənni xidməti")
                && change.newValue().contains("500.00 AZN / sabit")));
        venues.decision(owner, v.getId(), new VenueDecisionRequestDto(VenueStatus.ACTIVE, null));

        var b = bookings.create(user, new CreateBookingRequestDto(h.getId(), LocalDate.now().plusMonths(3), 100, List.of(), null, null), "review");
        assertThrows(BusinessException.class, () -> reviews.create(user, new CreateReviewRequestDto(b.getId(), 5, "Premature")));
        jdbc.update("update bookings set status_id=(select id from booking_statuses where code='CONFIRMED'), event_date=current_date-2 where id=?", b.getId());
        bookings.complete(b.getId());
        assertEquals("COMPLETED", jdbc.queryForObject("select s.code from bookings b join booking_statuses s on s.id=b.status_id where b.id=?", String.class, b.getId()));
        bookings.sendReviewPrompt(b.getId());
        bookings.sendReviewPrompt(b.getId());
        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where user_id=? and type='REVIEW_REQUEST'", Integer.class, user));
        assertEquals("/review/" + b.getId(), jdbc.queryForObject("select deep_link from notifications where user_id=? and type='REVIEW_REQUEST'", String.class, user));
        var venueReviewEntry = reviews.venueEligibility(user, v.getId()).orElseThrow();
        assertEquals(b.getId(), venueReviewEntry.bookingId());
        assertNotNull(venueReviewEntry.coverImageUrl());
        var createReview = new CreateReviewRequestDto(b.getId(), 5, "Great");
        createReview.setRatingFood(5);
        createReview.setRatingService(4);
        createReview.setRatingHall(5);
        createReview.setRatingValue(4);
        long id = reviews.create(user, createReview);
        assertTrue(stats.audit(0, 100, LocalDate.now(), LocalDate.now()).content().stream()
                .anyMatch(item -> item.getActorId() == user && item.getAction().equals("REVIEW_CREATED")));
        assertThrows(BusinessException.class, () -> reviews.create(user, createReview));
        var updateReview = new UpdateReviewRequestDto();
        updateReview.setRating(4);
        updateReview.setRatingFood(4);
        updateReview.setRatingService(4);
        updateReview.setRatingHall(5);
        updateReview.setRatingValue(4);
        updateReview.setComment("Updated");
        reviews.update(user, id, updateReview);
        assertEquals("Updated", jdbc.queryForObject("select comment from reviews where id=?", String.class, id));
        assertNotNull(jdbc.queryForObject("select edited_at from reviews where id=?", Instant.class, id));
        updateReview.setRating(5);
        reviews.update(user, id, updateReview);
        assertEquals(new BigDecimal("5.00"), venues.detail(v.getId()).getVenue().getRating());
        reviews.report(owner, id, new ReviewReportRequestDto("Aidiyyəti olmayan məzmun"));
        assertEquals("PENDING", jdbc.queryForObject("select moderation_status from reviews where id=?", String.class, id));
        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where user_id=? and type='REVIEW_REPORTED'", Integer.class, admin));
        assertTrue(jdbc.queryForObject("select body from notifications where user_id=? and type='REVIEW_REPORTED'", String.class, admin)
                .contains("Aidiyyəti olmayan məzmun"));
        reviews.moderate(owner, id, new ReviewModerationRequestDto("HIDDEN"));
        assertEquals("ACTION_TAKEN", jdbc.queryForObject("select moderation_status from reviews where id=?", String.class, id));
        assertEquals(new BigDecimal("0.00"), venues.detail(v.getId()).getVenue().getRating());
        venues.decision(owner, v.getId(), new VenueDecisionRequestDto(VenueStatus.SUSPENDED, null));
        assertThrows(BusinessException.class, () -> venues.detail(v.getId()));
    }

    @Test
    void adminMessageReachesVenueOwnerWithAdminContactNumber() {
        String suffix = UUID.randomUUID().toString();
        long owner = jdbc.queryForObject("insert into users(email,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,now(),(select id from user_roles where code='VENUE_OWNER'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class, "message-owner-" + suffix + "@example.com");
        long admin = jdbc.queryForObject("insert into users(email,phone,full_name,email_verified_at,role_id,status_id,preferred_lang,created_at,updated_at) values (?,?,?,now(),(select id from user_roles where code='ADMIN'),(select id from user_statuses where code='ACTIVE'),'az',now(),now()) returning id", Long.class,
                "message-admin-" + suffix + "@example.com", "+994501234567", "Nigar Admin");
        var venue = venues.create(owner, new VenueRequestDto("Mesaj məkanı", "message-" + suffix, null,
                "Mesaj ünvanı " + suffix, "Bakı", new BigDecimal("40.4"), new BigDecimal("49.8")));

        venues.messageOwner(admin, venue.getId(), "Sənədləri yenidən yoxlayın.");

        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where user_id=? and type='ADMIN_MESSAGE'", Integer.class, owner));
        String body = jdbc.queryForObject("select body from notifications where user_id=? and type='ADMIN_MESSAGE'", String.class, owner);
        assertTrue(body.contains("Sənədləri yenidən yoxlayın."));
        assertTrue(body.contains("Nigar Admin"));
        assertTrue(body.contains("+994501234567"));

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Baku"));
        var audit = stats.audit(0, 20, today, today).content().stream()
                .filter(item -> item.getAction().equals("VENUE_OWNER_MESSAGED") && Objects.equals(item.getEntityId(), venue.getId()))
                .findFirst().orElseThrow();
        assertEquals("Nigar Admin", audit.getActorName());
        assertEquals("Mesaj məkanı", audit.getEntityName());

        jdbc.update("update venues set status_id=(select id from venue_statuses where code='PENDING') where id=?", venue.getId());
        String rejectionReason = "VÖEN sənədini yenidən əlavə edin.";
        venues.decision(admin, venue.getId(), new VenueDecisionRequestDto(VenueStatus.REJECTED, rejectionReason));
        assertEquals(1, jdbc.queryForObject("select count(*) from notifications where user_id=? and type='VENUE_REJECTED'", Integer.class, owner));
        String rejectionBody = jdbc.queryForObject("select body from notifications where user_id=? and type='VENUE_REJECTED'", String.class, owner);
        assertTrue(rejectionBody.contains(rejectionReason));
    }
}
