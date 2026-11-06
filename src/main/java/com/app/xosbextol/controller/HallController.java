package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.JpaVenueService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class HallController {
    private final JpaVenueService service;

    @GetMapping("/api/halls/{id}/availability")
    Map<String, Object> availability(@PathVariable long id, @RequestParam String month) {
        return service.availability(id, YearMonth.parse(month));
    }

    @GetMapping("/api/catalog/{type}")
    Object catalog(@PathVariable String type) {
        return service.catalog(type);
    }
}
