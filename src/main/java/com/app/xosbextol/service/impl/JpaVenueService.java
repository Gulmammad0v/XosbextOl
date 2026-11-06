package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.value.VenueHallSnapshot;

import com.app.xosbextol.model.value.VenueExtraSnapshot;

import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.model.constant.AzerbaijanCities;
import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.repository.*;
import com.app.xosbextol.repository.cache.VenueCache;
import com.app.xosbextol.service.*;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.*;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
@Log4j2
public class JpaVenueService implements VenueAccess {
    public static final String TEST_AGREEMENT_VERSION = "TEST-2026-01";
    private static final String OWNER_NAME_CHANGE_PREFIX = "OWNER_NAME_CHANGE|";
    private static final String TEST_AGREEMENT = """
            TEST OFERTA / ƏMƏKDAŞLIQ MÜQAVİLƏSİ

            Bu sənəd yalnız məhsulun test mərhələsi üçündür və hüquqi məsləhət deyil.
            Restoran sahibi platformada verdiyi məlumatların, qiymətlərin, şəkillərin və sənədlərin doğru olduğunu təsdiq edir.
            Ləğv və geri ödəniş şərtləri rezervasiya zamanı müştəriyə göstərilən siyasətə əsaslanır.
            Müştəri yalnız rezervasiya depozitini platformada ödəyir, qalan məbləği isə tədbir günü restoranda ödəyir.
            Platforma yanlış məlumat, dublikat profil, saxta sənəd və ya xidmət pozuntusu aşkar etdikdə restoranı gizlədə və ya dondura bilər.
            Real istifadədən əvvəl ləğv, vergi, məlumatların emalı və payout müddəaları hüquqşünas tərəfindən yenidən hazırlanmalıdır.
            """;
    private final VenueRepository venues;
    private final HallRepository halls;
    private final UserRepository users;
    private final AmenityRepository amenities;
    private final HallBlockedDateRepository blockedDates;
    private final ExtraServiceRepository extraServices;
    private final BookingExtraServiceRepository bookingExtraServices;
    private final VenueMediaRepository media;
    private final VenueMenuPackageRepository menuPackages;
    private final VenueMenuPackageItemRepository menuPackageItems;
    private final VenueMenuCategoryRepository menuCategories;
    private final VenueMenuItemRepository menuItems;
    private final MenuItemTemplateRepository menuItemTemplates;
    private final ReviewRepository reviews;
    private final BookingCalendar calendar;
    private final AuditService audit;
    private final VenueCache cache;
    private final StandardVenueCatalogService standardCatalog;
    private final ObjectMapper objectMapper;
    private final NotificationService notifications;

    @Transactional(readOnly = true)
    public PageResponse<VenueItemResponseDto> search(String q, String city, Integer guests,
            BigDecimal minPrice, BigDecimal maxPrice, LocalDate date,
            BigDecimal minRating, int page, int size) {
        validatePage(page, size);
        if (city != null && !city.isBlank() && !AzerbaijanCities.contains(city)) {
            throw BusinessException.invalid("Şəhər yanlışdır");
        }
        if ((guests != null && guests < 1) || (minPrice != null && minPrice.signum() < 0)
                || (maxPrice != null && maxPrice.signum() < 0)
                || (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0)) {
            throw BusinessException.invalid("Filtr aralığı yanlışdır");
        }
        Set<Long> unavailable = new HashSet<>();
        if (date != null) {
            unavailable.addAll(calendar.unavailableHalls(date));
            unavailable.addAll(blockedDates.unavailableHallIds(date));
        }
        Specification<Venue> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("statusReference").get("code"), VenueStatus.ACTIVE.name()));
            predicates.add(cb.or(cb.isTrue(root.get("visible")), cb.isNull(root.get("visible"))));
            if (q != null && !q.isBlank()) predicates.add(cb.like(cb.lower(root.get("name")), "%" + q.toLowerCase(Locale.ROOT) + "%"));
            if (city != null && !city.isBlank()) predicates.add(cb.equal(root.get("city"), city));
            if (minRating != null) predicates.add(cb.ge(root.get("ratingAvg"), minRating));
            if (guests != null || date != null) {
                var subquery = query.subquery(Long.class);
                var hall = subquery.from(VenueHall.class);
                List<Predicate> hp = new ArrayList<>();
                hp.add(cb.equal(hall.get("venue").get("id"), root.get("id")));
                hp.add(cb.isTrue(hall.get("active")));
                if (guests != null) {
                    hp.add(cb.le(hall.get("capacityMin"), guests));
                    hp.add(cb.ge(hall.get("capacityMax"), guests));
                }
                if (!unavailable.isEmpty()) hp.add(cb.not(hall.get("id").in(unavailable)));
                subquery.select(hall.get("id")).where(hp.toArray(Predicate[]::new));
                predicates.add(cb.exists(subquery));
            }
            if (minPrice != null || maxPrice != null) {
                var subquery = query.subquery(Long.class);
                var menu = subquery.from(VenueMenuPackage.class);
                List<Predicate> mp = new ArrayList<>();
                mp.add(cb.equal(menu.get("venue").get("id"), root.get("id")));
                mp.add(cb.isTrue(menu.get("active")));
                if (minPrice != null) mp.add(cb.ge(menu.get("pricePerPerson"), minPrice));
                if (maxPrice != null) mp.add(cb.le(menu.get("pricePerPerson"), maxPrice));
                subquery.select(menu.get("id")).where(mp.toArray(Predicate[]::new));
                predicates.add(cb.exists(subquery));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("ratingAvg"), Sort.Order.asc("id")));
        java.util.function.Supplier<PageResponse<VenueItemResponseDto>> source =
                () -> PageResponse.from(venues.findAll(spec, pageable).map(this::item));
        return date == null ? cache.list(Arrays.asList(q, city, guests, minPrice, maxPrice, minRating, page, size).toString(), source) : source.get();
    }

    @Transactional(readOnly = true)
    public VenueDetailResponseDto detail(long id) {
        return cache.detail(id, () -> {
            Venue venue = requireVenue(id);
            if (venue.getStatus() != VenueStatus.ACTIVE) throw BusinessException.missing("Məkan");
            return details(venue, true);
        });
    }

    @Transactional(readOnly = true)
    public VenueDetailResponseDto slug(String slug) {
        return details(venues.findBySlugAndStatusReference_Code(slug, VenueStatus.ACTIVE.name())
                .orElseThrow(() -> BusinessException.missing("Məkan")), true);
    }

    @Transactional(readOnly = true)
    public PageResponse<VenueItemResponseDto> owned(long owner, int page, int size) {
        return PageResponse.from(venues.findByOwner_Id(owner, page(page, size)).map(this::item));
    }

    @Transactional(readOnly = true)
    public VenueDetailResponseDto ownedDetail(long owner, long id) {
        Venue venue = requireVenue(id);
        assertOwner(venue, owner);
        return details(venue, false);
    }

    @Transactional(readOnly = true)
    public List<BlockedDateResponseDto> blocks(long owner, long hallId) {
        VenueHall hall = requireHall(hallId);
        assertOwner(hall.getVenue(), owner);
        return blockedDates.findByHall_IdOrderByBlockedDate(hallId).stream().map(this::blockView).toList();
    }

    @Transactional
    public VenueItemResponseDto create(long owner, VenueRequestDto request) {
        Venue venue = new Venue();
        venue.setOwner(users.getReferenceById(owner));
        ensureUniqueAddress(0, request.getAddress());
        apply(venue, request);
        applyAmenities(venue, request.getAmenityIds(), request.getCustomAmenityNames());
        venue.setSlug(uniqueSlug(venue.getSlug()));
        venue.setStatus(VenueStatus.DRAFT);
        venues.saveAndFlush(venue);
        standardCatalog.ensureForVenue(venue);
        changed(venue.getId(), owner, "VENUE_CREATED", "VENUE", venue.getId());
        return item(venue);
    }

    @Transactional
    public VenueItemResponseDto update(long owner, long id, VenueRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, owner);
        ensureUniqueAddress(id, request.getAddress());
        boolean reapproval = requiresReapproval(venue);
        if (reapproval) requestReapproval(venue);
        apply(venue, request);
        applyAmenities(venue, request.getAmenityIds(), request.getCustomAmenityNames());
        if (!reapproval && venue.getStatus() == VenueStatus.REJECTED) venue.setStatus(VenueStatus.DRAFT);
        changed(id, owner, "VENUE_UPDATED", "VENUE", id);
        return item(venue);
    }

    @Transactional
    public HallResponseDto addHall(long owner, long venueId, HallRequestDto request) {
        Venue venue = requireVenue(venueId);
        assertEditable(venue, owner);
        requestReapprovalIfRequired(venue);
        VenueHall hall = new VenueHall();
        hall.setVenue(venue);
        apply(hall, request);
        halls.saveAndFlush(hall);
        changed(venueId, owner, "HALL_CREATED", "HALL", hall.getId());
        return hallView(hall);
    }

    @Transactional
    public HallResponseDto updateHall(long owner, long id, HallRequestDto request) {
        VenueHall hall = halls.lock(id).orElseThrow(() -> BusinessException.missing("Zal"));
        assertEditable(hall.getVenue(), owner);
        requestReapprovalIfRequired(hall.getVenue());
        apply(hall, request);
        changed(hall.getVenueId(), owner, "HALL_UPDATED", "HALL", id);
        return hallView(hall);
    }

    @Transactional
    public VenueItemResponseDto decision(long actor, long id, VenueDecisionRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        boolean reapprovalDecision = "REAPPROVAL_PENDING".equals(venue.getCriticalChangeStatus());
        boolean companyReapproval = "CHANGES_PENDING".equals(venue.getCompanyEditStatus());
        if (request.getStatus() == VenueStatus.ACTIVE) {
            requireReady(venue);
            venue.setApprovedAt(Instant.now());
            venue.setRejectionReason(null);
            venue.setVisible(true);
            if (isReapproval(venue)) {
                venue.setCriticalChangeStatus("REAPPROVAL_APPROVED");
                venue.setCriticalChangeReason(null);
                venue.setChangeReviewSnapshot(null);
            }
            if (companyReapproval) {
                venue.setCompanyEditStatus("REVIEW_APPROVED");
                venue.setCompanyEditDecisionReason(null);
                venue.setCompanyEditSnapshot(null);
            }
        } else if (request.getStatus() == VenueStatus.REJECTED) {
            if (request.getReason() == null || request.getReason().isBlank())
                throw BusinessException.invalid("Rədd səbəbi mütləqdir");
            venue.setRejectionReason(request.getReason().strip());
            if (isReapproval(venue)) {
                venue.setCriticalChangeStatus("REAPPROVAL_REJECTED");
                venue.setCriticalChangeReason(request.getReason().strip());
            }
            if (companyReapproval) {
                venue.setCompanyEditStatus("REVIEW_REJECTED");
                venue.setCompanyEditDecisionReason(request.getReason().strip());
            }
        }
        venue.setStatus(request.getStatus());
        if (reapprovalDecision && request.getStatus() == VenueStatus.ACTIVE) {
            notifications.localized(venue.getOwnerId(), "VENUE_CHANGE_APPROVED", venue.getName());
        } else if (request.getStatus() == VenueStatus.REJECTED) {
            String notificationType = reapprovalDecision ? "VENUE_CHANGE_REJECTED" : "VENUE_REJECTED";
            notifications.localized(venue.getOwnerId(), notificationType, venue.getName(), request.getReason().strip());
        }
        changed(id, actor, "VENUE_" + request.getStatus(), "VENUE", id);
        return item(venue);
    }

    @Transactional(readOnly = true)
    public PageResponse<VenueItemResponseDto> adminList(int page, int size) {
        return PageResponse.from(venues.findAll(page(page, size)).map(this::item));
    }

    @Transactional(readOnly = true)
    public PageResponse<VenueItemResponseDto> adminQueue(String status, int page, int size) {
        if (status == null || status.isBlank()) return adminList(page, size);
        VenueStatus parsed;
        try { parsed = VenueStatus.valueOf(status); }
        catch (IllegalArgumentException ex) { throw BusinessException.invalid("Status yanlışdır"); }
        return PageResponse.from(venues.findByStatusReference_Code(parsed.name(), page(page, size)).map(this::item));
    }

    @Transactional(readOnly = true)
    public VenueOnboardingResponseDto onboarding(long owner, long id) {
        Venue venue = requireVenue(id);
        assertOwner(venue, owner);
        return onboardingView(venue);
    }

    @Transactional(readOnly = true)
    public VenueOnboardingResponseDto onboardingAdmin(long id) {
        return onboardingView(requireVenue(id));
    }

    @Transactional(readOnly = true)
    public VenueDetailResponseDto adminDetail(long id) {
        return details(requireVenue(id), false);
    }

    @Transactional
    public void messageOwner(long adminId, long venueId, String rawMessage) {
        Venue venue = requireVenue(venueId);
        User admin = users.findById(adminId).orElseThrow(() -> BusinessException.missing("Admin"));
        String message = rawMessage.strip();
        String sender = admin.getFullName() == null || admin.getFullName().isBlank() ? "Platforma administratoru" : admin.getFullName();
        String phone = admin.getPhone() == null || admin.getPhone().isBlank() ? "qeyd edilməyib" : admin.getPhone();
        String title = "Admin tərəfindən mesaj · " + venue.getName();
        if (title.length() > 200) title = title.substring(0, 200);
        notifications.enqueue(venue.getOwnerId(), "ADMIN_MESSAGE", title,
                message + "\n\nGöndərən: " + sender + "\nƏlaqə telefonu: " + phone);
        audit.record(adminId, "VENUE_OWNER_MESSAGED", "VENUE", venueId);
    }

    @Transactional
    public VenueOnboardingResponseDto saveLegal(long owner, long id, VenueLegalRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, owner);
        boolean approvedCompanyEdit = venue.getStatus() == VenueStatus.ACTIVE;
        if (approvedCompanyEdit) {
            requireCompanyEditGrant(venue);
            requestReapproval(venue);
        } else if (isReapproval(venue)) {
            throw BusinessException.conflict("Şirkət məlumatlarını dəyişmək üçün admin icazəsi alın");
        }
        venue.setLegalName(request.legalName().strip());
        venue.setTaxId(request.taxId());
        venue.setFinCode(request.finCode().toUpperCase(Locale.ROOT));
        venue.setCompanyDocumentUrl(request.companyDocumentUrl());
        venue.setOwnerIdentityDocumentUrl(request.ownerIdentityDocumentUrl());
        if (approvedCompanyEdit) {
            venue.setCompanyEditStatus("CHANGES_PENDING");
            venue.setCompanyEditUsedAt(Instant.now());
            venue.setCompanyEditAllowedUntil(null);
        }
        changed(id, owner, "VENUE_LEGAL_UPDATED", "VENUE", id);
        return onboardingView(venue);
    }

    @Transactional
    public VenueOnboardingResponseDto requestCompanyEdit(long owner, long id, CompanyEditRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, owner);
        if (venue.getStatus() != VenueStatus.ACTIVE || isReapproval(venue))
            throw BusinessException.conflict("Şirkət məlumatı yalnız aktiv məkan üçün dəyişdirilə bilər");
        if ("REQUESTED".equals(venue.getCompanyEditStatus()))
            throw BusinessException.conflict("Sorğunuz artıq admin təsdiqini gözləyir");
        if (hasCompanyEditGrant(venue))
            throw BusinessException.conflict("Şirkət məlumatlarını dəyişmək üçün icazəniz artıq aktivdir");
        venue.setCompanyEditStatus("REQUESTED");
        venue.setCompanyEditRequestMessage(request.message().strip());
        venue.setCompanyEditRequestedAt(Instant.now());
        venue.setCompanyEditAllowedUntil(null);
        venue.setCompanyEditUsedAt(null);
        venue.setCompanyEditDecisionReason(null);
        venue.setCompanyEditSnapshot(null);
        notifications.enqueueForActiveAdmins("COMPANY_EDIT_REQUEST", "Şirkət məlumatı üçün dəyişiklik sorğusu",
                venue.getName() + " məkanının sahibi yazır: " + request.message().strip(), null);
        changed(id, owner, "COMPANY_EDIT_REQUESTED", "VENUE", id);
        return onboardingView(venue);
    }

    @Transactional
    public VenueOnboardingResponseDto decideCompanyEdit(long actor, long id, CompanyEditDecisionRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        if (!"REQUESTED".equals(venue.getCompanyEditStatus()))
            throw BusinessException.conflict("Gözləyən şirkət məlumatı sorğusu yoxdur");
        if (Boolean.TRUE.equals(request.approved())) {
            venue.setCompanyEditStatus("APPROVED");
            venue.setCompanyEditAllowedUntil(Instant.now().plus(Duration.ofDays(7)));
            venue.setCompanyEditDecisionReason(null);
            venue.setCompanyEditSnapshot(objectMapper.writeValueAsString(companyLegalSnapshot(venue)));
            notifications.enqueue(venue.getOwnerId(), "COMPANY_EDIT_APPROVED", "Dəyişiklik icazəsi verildi",
                    venue.getName() + " üçün şirkət məlumatlarını 7 gün ərzində bir dəfə dəyişə bilərsiniz.");
        } else {
            if (request.reason() == null || request.reason().isBlank())
                throw BusinessException.invalid("Rədd səbəbi mütləqdir");
            venue.setCompanyEditStatus("REJECTED");
            venue.setCompanyEditAllowedUntil(null);
            venue.setCompanyEditDecisionReason(request.reason().strip());
            notifications.enqueue(venue.getOwnerId(), "COMPANY_EDIT_REJECTED", "Dəyişiklik sorğusu rədd edildi",
                    venue.getName() + ": " + request.reason().strip());
        }
        changed(id, actor, Boolean.TRUE.equals(request.approved()) ? "COMPANY_EDIT_APPROVED" : "COMPANY_EDIT_REJECTED", "VENUE", id);
        return onboardingView(venue);
    }

    @Transactional(readOnly = true)
    public AgreementResponseDto agreement() {
        return new AgreementResponseDto(TEST_AGREEMENT_VERSION, "Test əməkdaşlıq ofertası", TEST_AGREEMENT, true);
    }

    @Transactional
    public VenueOnboardingResponseDto acceptAgreement(long owner, long id, AgreementAcceptanceRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertRegistrationEditable(venue, owner);
        if (!TEST_AGREEMENT_VERSION.equals(request.version()))
            throw BusinessException.conflict("Müqavilənin yeni versiyasını açıb qəbul edin");
        venue.setAgreementVersion(request.version());
        venue.setAgreementAcceptedAt(Instant.now());
        venue.setAgreementSignedBy(null);
        changed(id, owner, "VENUE_AGREEMENT_ACCEPTED", "VENUE", id);
        return onboardingView(venue);
    }

    @Transactional
    public VenueOnboardingResponseDto submit(long owner, long id) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, owner);
        requireReady(venue);
        if (venue.getStatus() == VenueStatus.ACTIVE)
            throw BusinessException.conflict("Aktiv restoran yenidən qeydiyyata göndərilə bilməz");
        venue.setStatus(VenueStatus.PENDING);
        venue.setSubmittedAt(Instant.now());
        venue.setRejectionReason(null);
        changed(id, owner, "VENUE_SUBMITTED", "VENUE", id);
        return onboardingView(venue);
    }

    @Transactional
    public MenuPackageResponseDto saveMenu(long owner, long venueId, Long menuId, MenuPackageRequestDto request) {
        Venue venue = requireVenue(venueId);
        assertEditable(venue, owner);
        requestReapprovalIfRequired(venue);
        String menuName = request.name().strip();
        VenueMenuPackage menu;
        if (menuId == null) {
            Optional<VenueMenuPackage> sameName = menuPackages.findByVenue_IdAndNameIgnoreCase(venueId, menuName);
            if (sameName.isPresent() && Boolean.TRUE.equals(sameName.get().getActive()))
                throw BusinessException.conflict("Bu adda menyu artıq mövcuddur");
            menu = sameName.orElseGet(VenueMenuPackage::new);
            menu.setVenue(venue);
        } else {
            menu = menuPackages.findByIdAndVenue_Id(menuId, venueId)
                    .orElseThrow(() -> BusinessException.missing("Menyu paketi"));
        }
        menu.setName(menuName);
        menu.setDescription(request.description());
        menu.setPricePerPerson(request.pricePerPerson());
        menu.setTier(request.tier());
        menu.setPopular(request.popular());
        menu.setActive(request.active());
        menuPackages.saveAndFlush(menu);
        if (request.categories() != null) {
            replaceMenuItems(venue, menu, request.categories());
        }
        changed(venueId, owner, menuId == null ? "MENU_PACKAGE_CREATED" : "MENU_PACKAGE_UPDATED", "MENU_PACKAGE", menu.getId());
        return menuViews(venueId).stream().filter(value -> value.getId() == menu.getId()).findFirst()
                .orElseThrow(() -> BusinessException.missing("Menyu paketi"));
    }

    @Transactional
    public void deleteMenu(long owner, long venueId, long menuId) {
        Venue venue = requireVenue(venueId);
        assertEditable(venue, owner);
        requestReapprovalIfRequired(venue);
        VenueMenuPackage menu = menuPackages.findByIdAndVenue_Id(menuId, venueId)
                .orElseThrow(() -> BusinessException.missing("Menyu paketi"));
        menu.setActive(false);
        changed(venueId, owner, "MENU_PACKAGE_DELETED", "MENU_PACKAGE", menuId);
    }

    private void replaceMenuItems(Venue venue, VenueMenuPackage menu, List<MenuCategoryRequestDto> requestedCategories) {
        Set<String> categoryNames = new HashSet<>();
        Set<String> itemNames = new HashSet<>();
        List<VenueMenuPackageItem> existing = menuPackageItems.findByMenuPackage_Id(menu.getId());
        menuPackageItems.deleteAll(existing);
        menuPackageItems.flush();

        for (MenuCategoryRequestDto requestedCategory : requestedCategories) {
            String categoryName = requestedCategory.name().strip();
            if (!categoryNames.add(categoryName.toLowerCase(Locale.ROOT)))
                throw BusinessException.invalid("Eyni menyu bölməsi bir neçə dəfə göndərilib");
            VenueMenuCategory category = menuCategories.findByVenue_IdAndNameIgnoreCase(venue.getId(), categoryName)
                    .orElseGet(() -> {
                        VenueMenuCategory value = new VenueMenuCategory();
                        value.setVenue(venue);
                        value.setName(categoryName);
                        return value;
                    });
            category.setSortOrder(requestedCategory.sortOrder());
            if (requestedCategory.defaultCustomizable() != null)
                category.setDefaultCustomizable(requestedCategory.defaultCustomizable());
            if (requestedCategory.defaultPricePerPerson() != null)
                category.setDefaultPricePerPerson(requestedCategory.defaultPricePerPerson());
            VenueMenuCategory persistedCategory = menuCategories.save(category);

            for (MenuItemRequestDto requestedItem : requestedCategory.items()) {
                String itemName = requestedItem.name().strip();
                String key = persistedCategory.getId() + ":" + itemName.toLowerCase(Locale.ROOT);
                if (!itemNames.add(key)) throw BusinessException.invalid("Eyni menyu məhsulu bir neçə dəfə göndərilib");
                VenueMenuItem item = menuItems.findByCategory_IdAndNameIgnoreCase(persistedCategory.getId(), itemName)
                        .orElseGet(() -> {
                            VenueMenuItem value = new VenueMenuItem();
                            value.setCategory(persistedCategory);
                            value.setName(itemName);
                            return value;
                        });
                item.setDescription(requestedItem.description());
                item.setSeasonal(requestedItem.seasonal());
                item.setCustomizable(requestedItem.customizable());
                if (requestedItem.customizable() && requestedItem.additionalPricePerPerson().signum() <= 0)
                    throw BusinessException.invalid("Dəyişdirilə bilən məhsulun qiyməti sıfırdan böyük olmalıdır");
                item.setAdditionalPricePerPerson(requestedItem.customizable() ? requestedItem.additionalPricePerPerson() : BigDecimal.ZERO);
                item.setActive(true);
                item = menuItems.save(item);

                VenueMenuPackageItem line = new VenueMenuPackageItem();
                line.setMenuPackage(menu);
                line.setMenuItem(item);
                menuPackageItems.save(line);
            }
        }
        menuPackageItems.flush();
    }

    @Transactional
    public VenueItemResponseDto adminUpdate(long actor, long id, VenueRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        ensureUniqueAddress(id, request.getAddress());
        apply(venue, request);
        changed(id, actor, "VENUE_ADMIN_UPDATED", "VENUE", id);
        return item(venue);
    }

    @Transactional
    public VenueOnboardingResponseDto decideCriticalChange(long actor, long id, CriticalChangeDecisionRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        if (!"PENDING".equals(venue.getCriticalChangeStatus()))
            throw BusinessException.conflict("Gözləyən kritik dəyişiklik yoxdur");
        if (Boolean.TRUE.equals(request.approved())) {
            if (venue.getPendingName() != null) venue.setName(venue.getPendingName());
            if (venue.getPendingAddress() != null) {
                ensureUniqueAddress(id, venue.getPendingAddress());
                venue.setAddress(venue.getPendingAddress());
            }
            if (venue.getPendingCity() != null) venue.setCity(venue.getPendingCity());
            if (venue.getPendingLatitude() != null) venue.setLatitude(venue.getPendingLatitude());
            if (venue.getPendingLongitude() != null) venue.setLongitude(venue.getPendingLongitude());
            venue.setCriticalChangeStatus("APPROVED");
            venue.setCriticalChangeReason(null);
        } else {
            if (request.reason() == null || request.reason().isBlank())
                throw BusinessException.invalid("Rədd səbəbi mütləqdir");
            venue.setCriticalChangeStatus("REJECTED");
            venue.setCriticalChangeReason(request.reason().strip());
        }
        clearPendingCritical(venue);
        changed(id, actor, Boolean.TRUE.equals(request.approved()) ? "CRITICAL_CHANGE_APPROVED" : "CRITICAL_CHANGE_REJECTED", "VENUE", id);
        return onboardingView(venue);
    }

    @Transactional
    public VenueOnboardingResponseDto visibility(long actor, long id, VenueVisibilityRequestDto request) {
        Venue venue = venues.lock(id).orElseThrow(() -> BusinessException.missing("Məkan"));
        venue.setFrozen(request.frozen());
        venue.setVisible(request.visible());
        changed(id, actor, request.frozen() ? "VENUE_FROZEN" : request.visible() ? "VENUE_VISIBLE" : "VENUE_HIDDEN", "VENUE", id);
        return onboardingView(venue);
    }

    @Transactional
    public long block(long owner, long hallId, BlockDateRequestDto request) {
        VenueHall hall = halls.lock(hallId).orElseThrow(() -> BusinessException.missing("Zal"));
        assertEditable(hall.getVenue(), owner);
        if (calendar.occupied(hallId, request.getDate())
                || blocked(hallId, request.getDate())) throw BusinessException.conflict("Bu tarix artıq doludur");
        HallBlockedDate value = new HallBlockedDate();
        value.setHall(hall);
        value.setBlockedDate(request.getDate());
        value.setReason(request.getReason());
        value.setCreatedBy(users.getReferenceById(owner));
        blockedDates.saveAndFlush(value);
        audit.record(owner, "DATE_BLOCKED", "HALL", hallId);
        return value.getId();
    }

    @Transactional
    public void unblock(long owner, long hallId, long blockId) {
        VenueHall hall = halls.lock(hallId).orElseThrow(() -> BusinessException.missing("Zal"));
        assertEditable(hall.getVenue(), owner);
        HallBlockedDate value = blockedDates.findById(blockId)
                .filter(block -> Objects.equals(block.getHall().getId(), hallId))
                .orElseThrow(() -> BusinessException.missing("Blok"));
        blockedDates.delete(value);
        audit.record(owner, "DATE_UNBLOCKED", "HALL", hallId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> availability(long hallId, YearMonth month) {
        requireHall(hallId);
        LocalDate from = month.atDay(1), to = month.atEndOfMonth();
        return Map.of("hallId", hallId, "month", month.toString(), "occupied", calendar.occupied(hallId, from, to),
                "blocked", blockedDates.findByHall_IdAndBlockedDateBetweenOrderByBlockedDate(hallId, from, to).stream().map(this::blockView).toList());
    }

    @Override @Transactional
    public VenueHallSnapshot lockBookableHall(long hallId) {
        VenueHall hall = halls.lock(hallId).orElseThrow(() -> BusinessException.missing("Zal"));
        if (!hall.getActive() || hall.getVenue().getStatus() != VenueStatus.ACTIVE) throw BusinessException.conflict("Zal rezervasiya üçün aktiv deyil");
        return snapshot(hall);
    }

    @Override @Transactional(readOnly = true)
    public VenueHallSnapshot hall(long hallId) { return snapshot(requireHall(hallId)); }

    @Override @Transactional
    public VenueHallSnapshot lockHall(long hallId) { return snapshot(halls.lock(hallId).orElseThrow(() -> BusinessException.missing("Zal"))); }

    @Override @Transactional(readOnly = true)
    public boolean blocked(long hallId, LocalDate date) { return blockedDates.existsByHall_IdAndBlockedDate(hallId, date); }

    @Override @Transactional(readOnly = true)
    public List<VenueExtraSnapshot> extras(long venueId, List<Long> ids) {
        List<VenueExtraSnapshot> result = new ArrayList<>();
        for (Long id : new LinkedHashSet<>(ids)) {
            ExtraService value = extraServices.findByIdAndVenue_IdAndActiveTrue(id, venueId)
                    .orElseThrow(() -> BusinessException.invalid("Əlavə xidmət bu məkana aid deyil"));
            result.add(new VenueExtraSnapshot(value.getId(), value.getName(), value.getPrice(), "PER_PERSON".equals(value.getPriceType())));
        }
        return result;
    }

    @Override @Transactional(readOnly = true)
    public void assertOwner(long venueId, long userId) { assertOwner(requireVenue(venueId), userId); }

    @Override @Transactional(readOnly = true)
    public void assertEditable(long venueId, long userId) { assertEditable(requireVenue(venueId), userId); }

    @Override @Transactional(readOnly = true)
    public void assertRegistrationEditable(long venueId, long userId) { assertRegistrationEditable(requireVenue(venueId), userId); }

    @Override @Transactional(readOnly = true)
    public void assertCompanyDocumentEditable(long venueId, long userId) {
        Venue venue = requireVenue(venueId);
        assertEditable(venue, userId);
        if (venue.getStatus() == VenueStatus.ACTIVE) requireCompanyEditGrant(venue);
        else if (isReapproval(venue)) throw BusinessException.conflict("Şirkət məlumatlarını dəyişmək üçün admin icazəsi alın");
    }

    @Override @Transactional
    public void requestReapproval(long venueId, long userId) {
        Venue venue = venues.lock(venueId).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, userId);
        requestReapprovalIfRequired(venue);
    }

    @Override @Transactional
    public void updateRating(long venueId) {
        Venue venue = venues.lock(venueId).orElseThrow(() -> BusinessException.missing("Məkan"));
        Object[] summary = reviews.visibleRatingSummary(venueId).getFirst();
        venue.setRatingAvg(BigDecimal.valueOf(((Number) summary[0]).doubleValue()).setScale(2, RoundingMode.HALF_UP));
        venue.setRatingCount(((Number) summary[1]).intValue());
        cache.changed(venueId);
    }

    @Transactional
    public long addExtra(long owner, long venueId, ExtraServiceRequestDto request) {
        Venue venue = requireVenue(venueId);
        assertEditable(venue, owner);
        requestReapprovalIfRequired(venue);
        ExtraService value = new ExtraService();
        value.setVenue(venue);
        apply(value, request);
        extraServices.saveAndFlush(value);
        changed(venueId, owner, "EXTRA_SERVICE_CREATED", "EXTRA_SERVICE", value.getId());
        return value.getId();
    }

    @Transactional
    public void updateExtra(long owner, long venueId, long id, ExtraServiceRequestDto request) {
        Venue venue = venues.lock(venueId).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, owner);
        requestReapprovalIfRequired(venue);
        apply(extraServices.findByIdAndVenue_Id(id, venueId).orElseThrow(() -> BusinessException.missing("Xidmət")), request);
        changed(venueId, owner, "EXTRA_SERVICE_UPDATED", "EXTRA_SERVICE", id);
    }

    @Transactional
    public void deleteExtra(long owner, long venueId, long id) {
        Venue venue = venues.lock(venueId).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, owner);
        ExtraService value = extraServices.findByIdAndVenue_Id(id, venueId)
                .orElseThrow(() -> BusinessException.missing("Xidmət"));
        if (bookingExtraServices.existsByService_Id(id))
            throw BusinessException.conflict("Rezervasiyada istifadə edilmiş xidməti silmək olmaz. Təqdim edilmir seçimini istifadə edin");
        requestReapprovalIfRequired(venue);
        extraServices.delete(value);
        changed(venueId, owner, "EXTRA_SERVICE_DELETED", "EXTRA_SERVICE", id);
    }

    @Transactional
    public long addMedia(long owner, long venueId, VenueMediaRequestDto request) {
        Venue venue = requireVenue(venueId);
        assertEditable(venue, owner);
        requestReapprovalIfRequired(venue);
        VenueHall hall = null;
        if (request.getHallId() != null) {
            hall = requireHall(request.getHallId());
            if (!Objects.equals(hall.getVenueId(), venueId)) throw BusinessException.invalid("Zal bu məkana aid deyil");
        }
        VenueMedia value = new VenueMedia();
        value.setVenue(venue);
        value.setHall(hall);
        value.setType(request.getType());
        value.setUrl(request.getUrl());
        value.setThumbUrl(request.getThumbUrl());
        value.setSortOrder(request.getSortOrder());
        media.saveAndFlush(value);
        changed(venueId, owner, "VENUE_MEDIA_CREATED", "VENUE_MEDIA", value.getId());
        return value.getId();
    }

    @Transactional
    public void amenities(long owner, long venueId, List<Short> ids) {
        Venue venue = venues.lock(venueId).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, owner);
        requestReapprovalIfRequired(venue);
        applyAmenities(venue, ids, List.of());
        changed(venueId, owner, "VENUE_AMENITIES_UPDATED", "VENUE", venueId);
    }

    @Transactional
    public void amenities(long owner, long venueId, List<Short> ids, List<String> customNames) {
        Venue venue = venues.lock(venueId).orElseThrow(() -> BusinessException.missing("Məkan"));
        assertEditable(venue, owner);
        requestReapprovalIfRequired(venue);
        applyAmenities(venue, ids, customNames);
        changed(venueId, owner, "VENUE_AMENITIES_UPDATED", "VENUE", venueId);
    }

    @Transactional(readOnly = true)
    public List<?> catalog(String type) {
        if ("cities".equals(type)) return AzerbaijanCities.VALUES;
        if ("amenities".equals(type)) return amenities.findAll(Sort.by("id")).stream().map(this::amenityView).toList();
        if ("menu-items".equals(type)) return menuItemTemplates.findByActiveTrueOrderByCategorySortOrderAscItemSortOrderAsc().stream()
                .map(item -> new MenuItemTemplateResponseDto(item.getId(), item.getCategoryName(), item.getCategorySortOrder(),
                        item.getItemName(), item.getItemSortOrder(), Boolean.TRUE.equals(item.getSeasonal())))
                .toList();
        throw BusinessException.missing("Kataloq");
    }

    private Venue requireVenue(long id) { return venues.findById(id).orElseThrow(() -> BusinessException.missing("Məkan")); }
    private String uniqueSlug(String requested) {
        String base = requested;
        String candidate = base;
        int suffix = 2;
        while (venues.existsBySlug(candidate)) candidate = base + "-" + suffix++;
        return candidate;
    }
    private VenueHall requireHall(long id) { return halls.findById(id).orElseThrow(() -> BusinessException.missing("Zal")); }
    private void assertOwner(Venue venue, long owner) { if (!Objects.equals(venue.getOwnerId(), owner)) throw BusinessException.forbidden(); }
    private void assertEditable(Venue venue, long owner) {
        assertOwner(venue, owner);
        if (Boolean.TRUE.equals(venue.getFrozen())) throw BusinessException.conflict("Restoran admin tərəfindən dondurulub");
    }
    private void assertRegistrationEditable(Venue venue, long owner) {
        assertEditable(venue, owner);
        if (venue.getStatus() == VenueStatus.ACTIVE || isReapproval(venue))
            throw BusinessException.conflict("Aktiv məkanın ödəniş və müqavilə məlumatları dəyişdirilə bilməz");
    }
    private boolean hasCompanyEditGrant(Venue venue) {
        return "APPROVED".equals(venue.getCompanyEditStatus())
                && venue.getCompanyEditUsedAt() == null
                && venue.getCompanyEditAllowedUntil() != null
                && venue.getCompanyEditAllowedUntil().isAfter(Instant.now());
    }
    private void requireCompanyEditGrant(Venue venue) {
        if (!hasCompanyEditGrant(venue))
            throw BusinessException.conflict("Şirkət məlumatlarını dəyişmək üçün aktiv admin icazəsi yoxdur");
    }
    private boolean isReapproval(Venue venue) {
        return venue.getCriticalChangeStatus() != null && venue.getCriticalChangeStatus().startsWith("REAPPROVAL_");
    }
    private boolean requiresReapproval(Venue venue) {
        return venue.getStatus() == VenueStatus.ACTIVE || isReapproval(venue);
    }
    private void requestReapprovalIfRequired(Venue venue) {
        if (requiresReapproval(venue)) requestReapproval(venue);
    }
    private void requestReapproval(Venue venue) {
        if (venue.getChangeReviewSnapshot() == null || venue.getChangeReviewSnapshot().isBlank()) {
            venue.setChangeReviewSnapshot(objectMapper.writeValueAsString(details(venue, false)));
        }
        venue.setStatus(VenueStatus.PENDING);
        venue.setSubmittedAt(Instant.now());
        venue.setRejectionReason(null);
        venue.setCriticalChangeStatus("REAPPROVAL_PENDING");
        if (venue.getCriticalChangeReason() == null || !venue.getCriticalChangeReason().startsWith(OWNER_NAME_CHANGE_PREFIX)) {
            venue.setCriticalChangeReason(null);
        }
        clearPendingCritical(venue);
    }
    private void changed(long venueId, Long actor, String action, String type, Long entityId) { cache.changed(venueId); audit.record(actor, action, type, entityId); }

    private VenueHallSnapshot snapshot(VenueHall hall) {
        Venue venue = hall.getVenue();
        return new VenueHallSnapshot(hall.getId(), venue.getId(), venue.getOwnerId(), hall.getCapacityMin(), hall.getCapacityMax(),
                hall.getPricePerPerson(), hall.getDepositPercent());
    }

    private VenueItemResponseDto item(Venue venue) {
        List<VenueHall> activeHalls = halls.findByVenue_IdAndActiveTrue(venue.getId());
        Integer capacityMin = activeHalls.stream().map(VenueHall::getCapacityMin).filter(Objects::nonNull).min(Integer::compareTo).orElse(null);
        Integer capacityMax = activeHalls.stream().map(VenueHall::getCapacityMax).filter(Objects::nonNull).max(Integer::compareTo).orElse(null);
        BigDecimal minPrice = menuPackages.findByVenue_IdAndActiveTrueOrderByTierAsc(venue.getId()).stream()
                .map(VenueMenuPackage::getPricePerPerson).filter(Objects::nonNull).min(BigDecimal::compareTo).orElse(null);
        return new VenueItemResponseDto(venue.getId(), venue.getName(), venue.getSlug(), venue.getAddress(), venue.getCity(),
                venue.getLatitude(), venue.getLongitude(), media.findFirstByVenue_IdAndHallIsNullAndTypeOrderBySortOrderAscIdAsc(venue.getId(), "IMAGE").map(this::previewUrl).orElse(null),
                venue.getRatingAvg(), venue.getRatingCount(), capacityMin, capacityMax, minPrice, venue.getStatus(), venue.getCriticalChangeStatus(), venue.getCompanyEditStatus());
    }

    private VenueDetailResponseDto details(Venue venue, boolean activeOnly) {
        List<VenueHall> venueHalls = activeOnly ? halls.findByVenue_IdAndActiveTrue(venue.getId()) : halls.findByVenue_Id(venue.getId());
        return new VenueDetailResponseDto(item(venue), venue.getDescription(), venueHalls.stream().map(this::hallView).toList(),
                media.findByVenue_IdOrderBySortOrderAscIdAsc(venue.getId()).stream().map(this::mediaView).toList(),
                venue.getAmenities().stream().map(this::amenityView).toList(),
                (activeOnly ? extraServices.findByVenue_IdAndActiveTrueOrderById(venue.getId())
                        : extraServices.findByVenue_IdOrderById(venue.getId())).stream().map(this::extraView).toList(),
                menuViews(venue.getId()));
    }

    private List<MenuPackageResponseDto> menuViews(long venueId) {
        List<VenueMenuPackage> packages = menuPackages.findByVenue_IdAndActiveTrueOrderByTierAsc(venueId);
        if (packages.isEmpty()) return List.of();
        List<Long> ids = packages.stream().map(VenueMenuPackage::getId).toList();
        Map<Long, List<VenueMenuPackageItem>> lines = menuPackageItems.findDetailedByPackageIds(ids).stream()
                .collect(java.util.stream.Collectors.groupingBy(line -> line.getMenuPackage().getId(), LinkedHashMap::new, java.util.stream.Collectors.toList()));
        return packages.stream().map(menu -> {
            Map<Long, List<VenueMenuItem>> grouped = lines.getOrDefault(menu.getId(), List.of()).stream()
                    .map(VenueMenuPackageItem::getMenuItem)
                    .collect(java.util.stream.Collectors.groupingBy(item -> item.getCategory().getId(), LinkedHashMap::new, java.util.stream.Collectors.toList()));
            List<MenuCategoryResponseDto> categories = grouped.values().stream().map(items -> {
                VenueMenuCategory category = items.getFirst().getCategory();
                return new MenuCategoryResponseDto(category.getId(), category.getName(), category.getSortOrder(),
                        category.getDefaultCustomizable(), category.getDefaultPricePerPerson(), items.stream()
                        .map(item -> new MenuItemResponseDto(item.getId(), item.getName(), item.getDescription(),
                                Boolean.TRUE.equals(item.getSeasonal()), Boolean.TRUE.equals(item.getCustomizable()),
                                item.getAdditionalPricePerPerson())).toList());
            }).toList();
            return new MenuPackageResponseDto(menu.getId(), menu.getName(), menu.getDescription(), menu.getPricePerPerson(),
                    Boolean.TRUE.equals(menu.getPopular()), menu.getTier(), categories);
        }).toList();
    }

    private HallResponseDto hallView(VenueHall value) { return new HallResponseDto(value.getId(), value.getName(), value.getCapacityMin(), value.getCapacityMax(), value.getPricePerPerson(), value.getDepositPercent(), value.getActive()); }
    private BlockedDateResponseDto blockView(HallBlockedDate value) { return new BlockedDateResponseDto(value.getId(), value.getBlockedDate(), value.getReason()); }
    private VenueMediaResponseDto mediaView(VenueMedia value) { return new VenueMediaResponseDto(value.getId(), value.getHall() == null ? null : value.getHall().getId(), value.getType(), value.getUrl(), value.getThumbUrl(), value.getSortOrder()); }
    private String previewUrl(VenueMedia value) { return value.getThumbUrl() != null ? value.getThumbUrl() : value.getUrl(); }
    private AmenityResponseDto amenityView(Amenity value) { return new AmenityResponseDto(value.getId(), value.getCode(), value.getNameAz(), value.getNameRu(), value.getNameEn(), value.getIcon()); }
    private ExtraServiceResponseDto extraView(ExtraService value) { return new ExtraServiceResponseDto(value.getId(), value.getName(), value.getDescription(), value.getPrice(), value.getPriceType(), value.getActive()); }

    private void apply(Venue venue, VenueRequestDto request) {
        venue.setName(request.getName()); venue.setSlug(request.getSlug()); venue.setDescription(request.getDescription()); venue.setAddress(request.getAddress());
        venue.setCity(request.getCity());
        venue.setLatitude(request.getLatitude()); venue.setLongitude(request.getLongitude());
    }

    private void ensureUniqueAddress(long id, String address) {
        if (address != null && venues.existsDuplicateAddress(id, address))
            throw BusinessException.conflict("Bu ünvan başqa restoranda istifadə olunur");
    }

    private VenueOnboardingResponseDto onboardingView(Venue venue) {
        List<OnboardingRequirementDto> requirements = requirements(venue);
        long complete = requirements.stream().filter(OnboardingRequirementDto::complete).count();
        int percent = (int) Math.round(100.0 * complete / requirements.size());
        return new VenueOnboardingResponseDto(venue.getId(), venue.getOwner().getFullName(), venue.getOwner().getEmail(), venue.getOwner().getPhone(),
                percent, venue.getStatus(), requirements,
                venue.getRejectionReason(), venue.getCriticalChangeStatus(), venue.getCriticalChangeReason(),
                reapprovalChanges(venue),
                venue.getPendingName(), venue.getPendingAddress(), venue.getPendingCity(),
                venue.getPendingLatitude(), venue.getPendingLongitude(),
                venue.getLegalName(), venue.getTaxId(), venue.getFinCode(), venue.getCompanyDocumentUrl(), venue.getOwnerIdentityDocumentUrl(),
                venue.getAgreementVersion(), venue.getAgreementAcceptedAt(),
                venue.getAgreementSignedBy(), venue.getCompanyEditStatus(), venue.getCompanyEditRequestMessage(),
                venue.getCompanyEditRequestedAt(), venue.getCompanyEditAllowedUntil(), venue.getCompanyEditUsedAt(),
                venue.getCompanyEditDecisionReason(), Boolean.TRUE.equals(venue.getFrozen()), Boolean.TRUE.equals(venue.getVisible()));
    }

    private List<VenueChangeDto> reapprovalChanges(Venue venue) {
        if (!isReapproval(venue)) return List.of();
        List<VenueChangeDto> ownerNameChanges = ownerNameChanges(venue);
        if (venue.getChangeReviewSnapshot() == null || venue.getChangeReviewSnapshot().isBlank()) return ownerNameChanges;
        try {
            VenueDetailResponseDto previous = objectMapper.readValue(venue.getChangeReviewSnapshot(), VenueDetailResponseDto.class);
            Map<String, ChangeValue> oldValues = flatten(previous);
            Map<String, ChangeValue> newValues = flatten(details(venue, false));
            Set<String> keys = new LinkedHashSet<>(oldValues.keySet());
            keys.addAll(newValues.keySet());
            List<VenueChangeDto> result = new ArrayList<>();
            Set<String> changedEntityPrefixes = new LinkedHashSet<>();
            for (String key : keys) {
                if (!key.endsWith(":present")) continue;
                ChangeValue oldValue = oldValues.get(key), newValue = newValues.get(key);
                if ((oldValue == null) == (newValue == null)) continue;
                String entityPrefix = key.substring(0, key.length() - "present".length());
                if (changedEntityPrefixes.stream().anyMatch(entityPrefix::startsWith)) continue;
                ChangeValue label = newValue != null ? newValue : oldValue;
                String before = oldValue == null ? "Mövcud deyil" : oldValue.value();
                String after = newValue == null ? "Mövcud deyil" : newValue.value();
                result.add(new VenueChangeDto(label.section(), label.field(), before, after,
                        oldValue == null ? "ADDED" : "REMOVED"));
                changedEntityPrefixes.add(entityPrefix);
            }
            for (String key : keys) {
                if (key.endsWith(":present") || changedEntityPrefixes.stream().anyMatch(key::startsWith)) continue;
                ChangeValue oldValue = oldValues.get(key), newValue = newValues.get(key);
                String before = oldValue == null ? "Mövcud deyil" : oldValue.value();
                String after = newValue == null ? "Mövcud deyil" : newValue.value();
                if (!Objects.equals(before, after)) {
                    ChangeValue label = newValue != null ? newValue : oldValue;
                    String changeType = oldValue == null ? "ADDED" : newValue == null ? "REMOVED" : "CHANGED";
                    result.add(new VenueChangeDto(label.section(), label.field(), before, after, changeType));
                }
            }
            addCompanyChanges(venue, result);
            result.addAll(ownerNameChanges);
            return result;
        } catch (RuntimeException ex) {
            log.warn("Venue reapproval snapshot could not be compared venueId={}", venue.getId(), ex);
            List<VenueChangeDto> result = new ArrayList<>(ownerNameChanges);
            result.add(new VenueChangeDto("Dəyişikliklər", "Müqayisə", "Əvvəlki məlumat oxunmadı", "Cari məlumatları yoxlayın", "CHANGED"));
            return result;
        }
    }

    private List<VenueChangeDto> ownerNameChanges(Venue venue) {
        String value = venue.getCriticalChangeReason();
        if (value == null || !value.startsWith(OWNER_NAME_CHANGE_PREFIX)) return List.of();
        try {
            String[] parts = value.substring(OWNER_NAME_CHANGE_PREFIX.length()).split("\\|", -1);
            if (parts.length != 2) return List.of();
            var decoder = Base64.getUrlDecoder();
            String oldName = new String(decoder.decode(parts[0]), java.nio.charset.StandardCharsets.UTF_8);
            String newName = new String(decoder.decode(parts[1]), java.nio.charset.StandardCharsets.UTF_8);
            return List.of(new VenueChangeDto("Məkan sahibi", "Ad və soyad", oldName, newName, "CHANGED"));
        } catch (IllegalArgumentException ex) {
            return List.of();
        }
    }

    private void addCompanyChanges(Venue venue, List<VenueChangeDto> result) {
        if (!"CHANGES_PENDING".equals(venue.getCompanyEditStatus()) || !present(venue.getCompanyEditSnapshot())) return;
        CompanyLegalSnapshot previous = objectMapper.readValue(venue.getCompanyEditSnapshot(), CompanyLegalSnapshot.class);
        CompanyLegalSnapshot current = companyLegalSnapshot(venue);
        addCompanyChange(result, "Hüquqi ad", previous.legalName(), current.legalName());
        addCompanyChange(result, "VÖEN", previous.taxId(), current.taxId());
        addCompanyChange(result, "FIN", previous.finCode(), current.finCode());
        addCompanyChange(result, "Şirkət sənədi", previous.companyDocumentUrl(), current.companyDocumentUrl());
        addCompanyChange(result, "Şəxsiyyət vəsiqəsi", previous.ownerIdentityDocumentUrl(), current.ownerIdentityDocumentUrl());
    }

    private void addCompanyChange(List<VenueChangeDto> result, String field, String before, String after) {
        if (!Objects.equals(before, after)) result.add(new VenueChangeDto("Şirkət məlumatları", field, before, after, "CHANGED"));
    }

    private CompanyLegalSnapshot companyLegalSnapshot(Venue venue) {
        return new CompanyLegalSnapshot(venue.getLegalName(), venue.getTaxId(), venue.getFinCode(),
                venue.getCompanyDocumentUrl(), venue.getOwnerIdentityDocumentUrl());
    }

    @lombok.Value
    @lombok.Builder
    @lombok.extern.jackson.Jacksonized
    @lombok.experimental.Accessors(fluent = true)
    private static class CompanyLegalSnapshot {
        String legalName;
        String taxId;
        String finCode;
        String companyDocumentUrl;
        String ownerIdentityDocumentUrl;
    }

    private Map<String, ChangeValue> flatten(VenueDetailResponseDto detail) {
        Map<String, ChangeValue> values = new LinkedHashMap<>();
        VenueItemResponseDto venue = detail.getVenue();
        put(values, "basic:name", "Əsas məlumatlar", "Məkan adı", venue.getName());
        put(values, "basic:slug", "Əsas məlumatlar", "Link", venue.getSlug());
        put(values, "basic:city", "Əsas məlumatlar", "Şəhər", venue.getCity());
        put(values, "basic:address", "Əsas məlumatlar", "Ünvan", venue.getAddress());
        put(values, "basic:latitude", "Əsas məlumatlar", "Enlik", venue.getLatitude());
        put(values, "basic:longitude", "Əsas məlumatlar", "Uzunluq", venue.getLongitude());
        put(values, "basic:description", "Əsas məlumatlar", "Təsvir", detail.getDescription());
        put(values, "basic:amenities", "Əsas məlumatlar", "İmkanlar", detail.getAmenities().stream()
                .map(value -> value.getNameAz() != null ? value.getNameAz() : value.getCode()).sorted().toList());
        for (HallResponseDto hall : detail.getHalls()) {
            String prefix = "hall:" + hall.getId() + ":", label = "Zal #" + hall.getId();
            put(values, prefix + "present", "Zallar", label + " — zal", hall.getName());
            put(values, prefix + "name", "Zallar", label + " — ad", hall.getName());
            put(values, prefix + "capacityMin", "Zallar", label + " — minimum tutum", hall.getCapacityMin());
            put(values, prefix + "capacityMax", "Zallar", label + " — maksimum tutum", hall.getCapacityMax());
            put(values, prefix + "price", "Zallar", label + " — nəfər qiyməti", hall.getPricePerPerson());
            put(values, prefix + "deposit", "Zallar", label + " — depozit faizi", hall.getDepositPercent());
            put(values, prefix + "active", "Zallar", label + " — status", hall.isActive() ? "Aktiv" : "Deaktiv");
        }
        for (VenueMediaResponseDto item : detail.getMedia()) {
            String label = item.getHallId() == null ? "Restoran şəkli #" + item.getId() : "Zal #" + item.getHallId() + " şəkli #" + item.getId();
            put(values, "media:" + item.getId(), "Şəkillər", label, item.getUrl());
        }
        for (MenuPackageResponseDto menu : detail.getMenus()) {
            String prefix = "menu:" + menu.getId() + ":", label = "Menyu #" + menu.getId();
            put(values, prefix + "present", "Menyular", label + " — menyu", menu.getName());
            put(values, prefix + "name", "Menyular", label + " — ad", menu.getName());
            put(values, prefix + "description", "Menyular", label + " — təsvir", menu.getDescription());
            put(values, prefix + "price", "Menyular", label + " — nəfər qiyməti", menu.getPricePerPerson());
            put(values, prefix + "tier", "Menyular", label + " — səviyyə", menu.getTier());
            put(values, prefix + "popular", "Menyular", label + " — populyar", menu.isPopular() ? "Bəli" : "Xeyr");
            for (MenuCategoryResponseDto category : menu.getCategories()) {
                String categoryPrefix = prefix + "category:" + category.getId() + ":";
                String categoryLabel = label + " · " + category.getName();
                put(values, categoryPrefix + "name", "Menyular", categoryLabel + " — bölmə adı", category.getName());
                put(values, categoryPrefix + "sortOrder", "Menyular", categoryLabel + " — bölmə sırası", category.getSortOrder());
                for (MenuItemResponseDto item : category.getItems()) {
                    String itemPrefix = categoryPrefix + "item:" + item.getId() + ":";
                    String itemLabel = categoryLabel + " · " + item.getName();
                    put(values, itemPrefix + "present", "Menyular", itemLabel + " — məhsul", menuItemSummary(item));
                    put(values, itemPrefix + "name", "Menyular", itemLabel + " — məhsul adı", item.getName());
                    put(values, itemPrefix + "description", "Menyular", itemLabel + " — təsvir", item.getDescription());
                    put(values, itemPrefix + "seasonal", "Menyular", itemLabel + " — mövsümi", item.isSeasonal() ? "Bəli" : "Xeyr");
                    put(values, itemPrefix + "customizable", "Menyular", itemLabel + " — dəyişdirilə bilər", item.isCustomizable() ? "Bəli" : "Xeyr");
                    put(values, itemPrefix + "additionalPrice", "Menyular", itemLabel + " — dəyişiklik qiyməti", item.getAdditionalPricePerPerson() + " AZN");
                }
            }
        }
        for (ExtraServiceResponseDto service : detail.getServices()) {
            String prefix = "service:" + service.getId() + ":", label = "Xidmət #" + service.getId();
            put(values, prefix + "present", "Əlavə xidmətlər", label + " — xidmət", extraServiceSummary(service));
            put(values, prefix + "name", "Əlavə xidmətlər", label + " — ad", service.getName());
            put(values, prefix + "description", "Əlavə xidmətlər", label + " — təsvir", service.getDescription());
            put(values, prefix + "price", "Əlavə xidmətlər", label + " — qiymət", service.getPrice());
            put(values, prefix + "priceType", "Əlavə xidmətlər", label + " — qiymət növü", service.getPriceType());
            put(values, prefix + "active", "Əlavə xidmətlər", label + " — status", service.isActive() ? "Aktiv" : "Deaktiv");
        }
        return values;
    }

    private String menuItemSummary(MenuItemResponseDto item) {
        StringBuilder summary = new StringBuilder(item.getName());
        if (present(item.getDescription())) summary.append(" — ").append(item.getDescription());
        if (item.isSeasonal()) summary.append(" · mövsümi");
        if (item.isCustomizable()) summary.append(" · dəyişdirilə bilər (").append(item.getAdditionalPricePerPerson()).append(" AZN)");
        return summary.toString();
    }

    private String extraServiceSummary(ExtraServiceResponseDto service) {
        StringBuilder summary = new StringBuilder(service.getName());
        if (present(service.getDescription())) summary.append(" — ").append(service.getDescription());
        if (service.getPrice() != null && service.getPrice().signum() > 0) {
            summary.append(" · ").append(service.getPrice()).append(" AZN");
            summary.append("PER_PERSON".equals(service.getPriceType()) ? " / nəfər" : " / sabit");
        }
        return summary.toString();
    }

    private void put(Map<String, ChangeValue> values, String key, String section, String field, Object value) {
        String text;
        if (value == null) text = "Daxil edilməyib";
        else if (value instanceof Collection<?> collection) text = collection.isEmpty() ? "Seçilməyib" : collection.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(", "));
        else text = String.valueOf(value);
        values.put(key, new ChangeValue(section, field, text));
    }

    @lombok.Value
    @lombok.Builder
    @lombok.extern.jackson.Jacksonized
    @lombok.experimental.Accessors(fluent = true)
    private static class ChangeValue {
        String section;
        String field;
        String value;
    }

    private List<OnboardingRequirementDto> requirements(Venue venue) {
        long imageCount = media.countByVenue_IdAndHallIsNullAndType(venue.getId(), "IMAGE");
        List<VenueHall> venueHalls = halls.findByVenue_Id(venue.getId());
        boolean hallPhotos = !venueHalls.isEmpty() && venueHalls.stream()
                .allMatch(hall -> media.existsByHall_IdAndType(hall.getId(), "IMAGE"));
        boolean location = venue.getAddress() != null && !venue.getAddress().isBlank()
                && venue.getLatitude() != null && venue.getLongitude() != null && venue.getCity() != null;
        boolean legalDocuments = present(venue.getTaxId()) && present(venue.getFinCode()) && venue.getFinCode().matches("[A-Z0-9]{7}") && present(venue.getCompanyDocumentUrl())
                && present(venue.getOwnerIdentityDocumentUrl());
        return List.of(
                new OnboardingRequirementDto("BASIC", "Əsas məlumatlar", present(venue.getName()) && location),
                new OnboardingRequirementDto("HALL", "Ən azı 1 zal", !venueHalls.isEmpty()),
                new OnboardingRequirementDto("HALL_PHOTOS", "Hər zal üçün ən azı 1 ayrıca şəkil", hallPhotos),
                new OnboardingRequirementDto("PHOTOS", "Restoran şəkilləri", imageCount >= 5),
                new OnboardingRequirementDto("MENU", "Məhsulları olan ən azı 1 menyu", menuPackageItems.existsByMenuPackage_Venue_IdAndMenuPackage_ActiveTrue(venue.getId())),
                new OnboardingRequirementDto("DOCUMENTS", "VÖEN, FIN və şəxsiyyət/şirkət sənədləri", legalDocuments),
                new OnboardingRequirementDto("AGREEMENT", "Müqavilənin cari versiyası qəbul edilib",
                        TEST_AGREEMENT_VERSION.equals(venue.getAgreementVersion()) && venue.getAgreementAcceptedAt() != null)
        );
    }

    private void requireReady(Venue venue) {
        List<String> missing = requirements(venue).stream().filter(value -> !value.complete())
                .map(OnboardingRequirementDto::label).toList();
        if (!missing.isEmpty()) throw BusinessException.invalid("Təsdiqə göndərmək üçün tamamlayın: " + String.join(", ", missing));
    }

    private boolean present(String value) { return value != null && !value.isBlank(); }
    private void clearPendingCritical(Venue venue) {
        venue.setPendingName(null);
        venue.setPendingAddress(null);
        venue.setPendingCity(null);
        venue.setPendingLatitude(null);
        venue.setPendingLongitude(null);
    }

    private void apply(VenueHall hall, HallRequestDto request) {
        if (request.getCapacityMax() < request.getCapacityMin()) throw BusinessException.invalid("Tutum aralığı yanlışdır");
        hall.setName(request.getName()); hall.setCapacityMin(request.getCapacityMin()); hall.setCapacityMax(request.getCapacityMax());
        hall.setPricePerPerson(request.getPricePerPerson() == null ? BigDecimal.ZERO : request.getPricePerPerson());
        hall.setDepositPercent(request.getDepositPercent()); hall.setActive(request.isActive());
    }

    private void apply(ExtraService value, ExtraServiceRequestDto request) {
        value.setName(request.getName()); value.setDescription(request.getDescription()); value.setPrice(request.getPrice());
        value.setPriceType(request.getPriceType()); value.setActive(request.isActive());
    }

    private void applyAmenities(Venue venue, List<Short> ids, List<String> customNames) {
        if (ids == null && customNames == null) return;
        List<Short> selectedIds = ids == null ? List.of() : ids;
        List<String> additions = customNames == null ? List.of() : customNames;
        if (selectedIds.size() > 100 || additions.size() > 50 || selectedIds.stream().anyMatch(Objects::isNull))
            throw BusinessException.invalid("İmkanlar siyahısı yanlışdır");

        Set<Short> uniqueIds = new LinkedHashSet<>(selectedIds);
        List<Amenity> selected = new ArrayList<>(amenities.findAllById(uniqueIds));
        if (selected.size() != uniqueIds.size()) throw BusinessException.invalid("İmkan tapılmadı");

        Set<String> uniqueNames = new LinkedHashSet<>();
        for (String rawName : additions) {
            if (rawName == null || rawName.isBlank() || rawName.trim().length() > 100)
                throw BusinessException.invalid("İmkan adı yanlışdır");
            String name = rawName.trim();
            if (!uniqueNames.add(name.toLowerCase(Locale.forLanguageTag("az")))) continue;
            Amenity amenity = amenities.findByNameAzIgnoreCase(name).orElseGet(() ->
                    amenities.save(new Amenity("CUSTOM_" + UUID.randomUUID().toString().replace("-", ""), name, null, null)));
            selected.add(amenity);
        }
        if (selected.size() > 100) throw BusinessException.invalid("Ən çox 100 imkan seçilə bilər");
        venue.getAmenities().clear();
        venue.getAmenities().addAll(selected);
    }

    private Pageable page(int page, int size) { validatePage(page, size); return PageRequest.of(page, size, Sort.by("id").descending()); }
    private void validatePage(int page, int size) { if (page < 0 || size < 1 || size > 100) throw BusinessException.invalid("Səhifə ölçüsü 1–100 olmalıdır"); }
}
