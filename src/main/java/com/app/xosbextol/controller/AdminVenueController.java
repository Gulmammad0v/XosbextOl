package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.JpaVenueService;
import com.app.xosbextol.model.dto.VenueDecisionRequestDto;
import com.app.xosbextol.model.dto.VenueItemResponseDto;
import com.app.xosbextol.model.dto.PageResponse;
import com.app.xosbextol.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/venues")
@RequiredArgsConstructor
public class AdminVenueController {
    private final JpaVenueService service;

    @GetMapping
    PageResponse<VenueItemResponseDto> list(@RequestParam(required = false) String status,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return service.adminQueue(status, page, size);
    }

    @PatchMapping("/{id}")
    VenueItemResponseDto decide(@PathVariable long id, @Valid @RequestBody VenueDecisionRequestDto req) {
        return service.decision(CurrentUser.id(), id, req);
    }

    @GetMapping("/{id}/onboarding")
    com.app.xosbextol.model.dto.VenueOnboardingResponseDto onboarding(@PathVariable long id) {
        return service.onboardingAdmin(id);
    }

    @GetMapping("/{id}")
    com.app.xosbextol.model.dto.VenueDetailResponseDto detail(@PathVariable long id) {
        return service.adminDetail(id);
    }

    @PutMapping("/{id}")
    VenueItemResponseDto edit(@PathVariable long id, @Valid @RequestBody com.app.xosbextol.model.dto.VenueRequestDto req) {
        return service.adminUpdate(CurrentUser.id(), id, req);
    }

    @PatchMapping("/{id}/critical-change")
    com.app.xosbextol.model.dto.VenueOnboardingResponseDto criticalChange(
            @PathVariable long id,
            @Valid @RequestBody com.app.xosbextol.model.dto.CriticalChangeDecisionRequestDto req) {
        return service.decideCriticalChange(CurrentUser.id(), id, req);
    }

    @PatchMapping("/{id}/company-edit-request")
    com.app.xosbextol.model.dto.VenueOnboardingResponseDto decideCompanyEdit(
            @PathVariable long id,
            @Valid @RequestBody com.app.xosbextol.model.dto.CompanyEditDecisionRequestDto req) {
        return service.decideCompanyEdit(CurrentUser.id(), id, req);
    }

    @PatchMapping("/{id}/visibility")
    com.app.xosbextol.model.dto.VenueOnboardingResponseDto visibility(
            @PathVariable long id,
            @Valid @RequestBody com.app.xosbextol.model.dto.VenueVisibilityRequestDto req) {
        return service.visibility(CurrentUser.id(), id, req);
    }

    @PostMapping("/{id}/message")
    void messageOwner(@PathVariable long id,
                      @Valid @RequestBody com.app.xosbextol.model.dto.AdminVenueMessageRequestDto req) {
        service.messageOwner(CurrentUser.id(), id, req.message());
    }
}
