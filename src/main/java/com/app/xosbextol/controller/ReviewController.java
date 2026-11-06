package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.ReviewService;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ReviewController {
    private final ReviewService service;

    @PostMapping("/api/reviews")
    Map<String, Long> create(@Valid @RequestBody CreateReviewRequestDto req) {
        return Map.of("id", service.create(CurrentUser.id(), req));
    }

    @GetMapping("/api/reviews/booking/{id}")
    Object eligibility(@PathVariable long id) {
        return service.eligibility(CurrentUser.id(), id);
    }

    @GetMapping("/api/reviews/eligibility/venue/{id}")
    org.springframework.http.ResponseEntity<ReviewEligibilityResponseDto> venueEligibility(@PathVariable long id) {
        return org.springframework.http.ResponseEntity.of(service.venueEligibility(CurrentUser.id(), id));
    }

    @PutMapping("/api/reviews/{id}")
    void update(@PathVariable long id, @Valid @RequestBody UpdateReviewRequestDto req) {
        service.update(CurrentUser.id(), id, req);
    }

    @GetMapping("/api/reviews/venue/{id}")
    Map<String, Object> list(@PathVariable long id, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(id, page, size);
    }

    @PutMapping("/api/partner/reviews/{id}/reply")
    void reply(@PathVariable long id, @Valid @RequestBody ReviewReplyRequestDto req) {
        service.reply(CurrentUser.id(), id, req);
    }

    @PostMapping("/api/partner/reviews/{id}/report")
    void report(@PathVariable long id, @Valid @RequestBody ReviewReportRequestDto req) {
        service.report(CurrentUser.id(), id, req);
    }

    @GetMapping("/api/admin/reviews/reported")
    Map<String, Object> reported(@RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "20") int size) {
        return service.reported(page, size);
    }

    @PatchMapping("/api/admin/reviews/{id}")
    void moderate(@PathVariable long id, @Valid @RequestBody ReviewModerationRequestDto req) {
        service.moderate(CurrentUser.id(), id, req);
    }
}
