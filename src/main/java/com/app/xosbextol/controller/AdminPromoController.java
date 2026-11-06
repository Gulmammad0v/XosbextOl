package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.PromoService;
import com.app.xosbextol.model.dto.PromoRequestDto;
import com.app.xosbextol.model.dto.PromoStatusRequestDto;
import com.app.xosbextol.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/promos")
@RequiredArgsConstructor
public class AdminPromoController {
    private final PromoService promos;

    @GetMapping
    Object list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return promos.list(page, size);
    }

    @PostMapping
    Map<String, Long> create(@Valid @RequestBody PromoRequestDto req) {
        return Map.of("id", promos.create(CurrentUser.id(), req));
    }

    @PutMapping("/{id}")
    void update(@PathVariable long id, @Valid @RequestBody PromoRequestDto req) {
        promos.update(CurrentUser.id(), id, req);
    }

    @PatchMapping("/{id}/active")
    void active(@PathVariable long id, @Valid @RequestBody PromoStatusRequestDto req) {
        promos.setActive(CurrentUser.id(), id, req.active());
    }
}
