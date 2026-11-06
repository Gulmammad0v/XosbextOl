package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.FavoriteService;
import com.app.xosbextol.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {
    private final FavoriteService service;

    @GetMapping
    Map<String, Object> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(CurrentUser.id(), page, size);
    }

    @PutMapping("/{venue}")
    void add(@PathVariable long venue) {
        service.add(CurrentUser.id(), venue);
    }

    @DeleteMapping("/{venue}")
    void remove(@PathVariable long venue) {
        service.remove(CurrentUser.id(), venue);
    }
}
