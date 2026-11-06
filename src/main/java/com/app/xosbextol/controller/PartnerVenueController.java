package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.JpaVenueService;
import com.app.xosbextol.service.impl.MediaService;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.model.dto.PageResponse;
import com.app.xosbextol.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/partner")
@RequiredArgsConstructor
public class PartnerVenueController {
    private final JpaVenueService service;
    private final MediaService mediaService;

    @GetMapping("/venues")
    PageResponse<VenueItemResponseDto> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.owned(CurrentUser.id(), page, size);
    }

    @GetMapping("/venues/{id}")
    VenueDetailResponseDto detail(@PathVariable long id) {
        return service.ownedDetail(CurrentUser.id(), id);
    }

    @GetMapping("/halls/{id}/blocks")
    Object blocks(@PathVariable long id) {
        return service.blocks(CurrentUser.id(), id);
    }

    @PostMapping("/venues")
    VenueItemResponseDto create(@Valid @RequestBody VenueRequestDto req) {
        return service.create(CurrentUser.id(), req);
    }

    @PutMapping("/venues/{id}")
    VenueItemResponseDto update(@PathVariable long id, @Valid @RequestBody VenueRequestDto req) {
        return service.update(CurrentUser.id(), id, req);
    }

    @PostMapping("/venues/{id}/halls")
    HallResponseDto hall(@PathVariable long id, @Valid @RequestBody HallRequestDto req) {
        return service.addHall(CurrentUser.id(), id, req);
    }

    @PutMapping("/halls/{id}")
    HallResponseDto hallUpdate(@PathVariable long id, @Valid @RequestBody HallRequestDto req) {
        return service.updateHall(CurrentUser.id(), id, req);
    }

    @PostMapping("/halls/{id}/blocks")
    Map<String, Long> block(@PathVariable long id, @Valid @RequestBody BlockDateRequestDto req) {
        return Map.of("id", service.block(CurrentUser.id(), id, req));
    }

    @DeleteMapping("/halls/{id}/blocks/{blockId}")
    void unblock(@PathVariable long id, @PathVariable long blockId) {
        service.unblock(CurrentUser.id(), id, blockId);
    }

    @PostMapping("/venues/{id}/services")
    Map<String, Long> extra(@PathVariable long id, @Valid @RequestBody ExtraServiceRequestDto req) {
        return Map.of("id", service.addExtra(CurrentUser.id(), id, req));
    }

    @PutMapping("/venues/{id}/services/{serviceId}")
    void extraUpdate(@PathVariable long id, @PathVariable long serviceId, @Valid @RequestBody ExtraServiceRequestDto req) {
        service.updateExtra(CurrentUser.id(), id, serviceId, req);
    }

    @DeleteMapping("/venues/{id}/services/{serviceId}")
    void extraDelete(@PathVariable long id, @PathVariable long serviceId) {
        service.deleteExtra(CurrentUser.id(), id, serviceId);
    }

    @PostMapping("/venues/{id}/media")
    Map<String, Long> media(@PathVariable long id, @Valid @RequestBody VenueMediaRequestDto req) {
        return Map.of("id", service.addMedia(CurrentUser.id(), id, req));
    }

    @DeleteMapping("/venues/{id}/media/{mediaId}")
    void mediaDelete(@PathVariable long id, @PathVariable long mediaId) {
        mediaService.delete(CurrentUser.id(), id, mediaId);
    }

    @PutMapping("/venues/{id}/amenities")
    void amenities(@PathVariable long id, @RequestBody List<Short> ids) {
        service.amenities(CurrentUser.id(), id, ids);
    }

    @PutMapping("/venues/{id}/amenity-selection")
    void amenitySelection(@PathVariable long id, @Valid @RequestBody AmenitySelectionRequestDto req) {
        service.amenities(CurrentUser.id(), id, req.ids(), req.customNames());
    }

    @GetMapping("/venues/{id}/onboarding")
    VenueOnboardingResponseDto onboarding(@PathVariable long id) {
        return service.onboarding(CurrentUser.id(), id);
    }

    @PatchMapping("/venues/{id}/legal")
    VenueOnboardingResponseDto legal(@PathVariable long id, @Valid @RequestBody VenueLegalRequestDto req) {
        return service.saveLegal(CurrentUser.id(), id, req);
    }

    @PostMapping("/venues/{id}/company-edit-request")
    VenueOnboardingResponseDto requestCompanyEdit(@PathVariable long id,
                                                  @Valid @RequestBody CompanyEditRequestDto req) {
        return service.requestCompanyEdit(CurrentUser.id(), id, req);
    }

    @GetMapping("/agreement")
    AgreementResponseDto agreement() {
        return service.agreement();
    }

    @PostMapping("/venues/{id}/agreement/accept")
    VenueOnboardingResponseDto acceptAgreement(@PathVariable long id, @Valid @RequestBody AgreementAcceptanceRequestDto req) {
        return service.acceptAgreement(CurrentUser.id(), id, req);
    }

    @PostMapping("/venues/{id}/menus")
    MenuPackageResponseDto menu(@PathVariable long id, @Valid @RequestBody MenuPackageRequestDto req) {
        return service.saveMenu(CurrentUser.id(), id, null, req);
    }

    @PutMapping("/venues/{id}/menus/{menuId}")
    MenuPackageResponseDto menuUpdate(@PathVariable long id, @PathVariable long menuId, @Valid @RequestBody MenuPackageRequestDto req) {
        return service.saveMenu(CurrentUser.id(), id, menuId, req);
    }

    @DeleteMapping("/venues/{id}/menus/{menuId}")
    void menuDelete(@PathVariable long id, @PathVariable long menuId) {
        service.deleteMenu(CurrentUser.id(), id, menuId);
    }

    @PostMapping("/venues/{id}/submit")
    VenueOnboardingResponseDto submit(@PathVariable long id) {
        return service.submit(CurrentUser.id(), id);
    }
}
