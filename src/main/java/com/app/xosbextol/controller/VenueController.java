package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.JpaVenueService;
import com.app.xosbextol.model.dto.VenueDetailResponseDto;
import com.app.xosbextol.model.dto.VenueItemResponseDto;
import com.app.xosbextol.model.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/venues")
@RequiredArgsConstructor
public class VenueController {
    private final JpaVenueService service;

    @GetMapping
    PageResponse<VenueItemResponseDto> search(@RequestParam(required = false) String q, @RequestParam(required = false) String city,
                                              @RequestParam(required = false) Integer guests, @RequestParam(required = false) BigDecimal minPrice, @RequestParam(required = false) BigDecimal maxPrice,
                                              @RequestParam(required = false) LocalDate date, @RequestParam(required = false) BigDecimal minRating,
                                              @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.search(q, city, guests, minPrice, maxPrice, date, minRating, page, size);
    }

    @GetMapping("/{id}")
    VenueDetailResponseDto detail(@PathVariable long id) {
        return service.detail(id);
    }

    @GetMapping("/slug/{slug}")
    VenueDetailResponseDto slug(@PathVariable String slug) {
        return service.slug(slug);
    }
}
