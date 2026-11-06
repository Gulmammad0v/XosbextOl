package com.app.xosbextol.controller;

import com.app.xosbextol.service.impl.MediaService;
import com.app.xosbextol.security.CurrentUser;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import lombok.RequiredArgsConstructor;

import java.io.IOException;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class MediaController {
    private final MediaService media;

    @PostMapping(value = "/api/partner/venues/{id}/media/upload", consumes = "multipart/form-data")
    Map<String, Object> upload(@PathVariable long id, @RequestParam(name = "hallId", required = false) Long hallId,
                               @RequestPart("file") MultipartFile file) throws IOException {
        return media.upload(CurrentUser.id(), id, hallId, file.getBytes());
    }

    @PostMapping(value = "/api/partner/venues/{id}/documents/{documentType}/upload", consumes = "multipart/form-data")
    Map<String, Object> uploadDocument(@PathVariable long id, @PathVariable String documentType,
                                       @RequestPart("file") MultipartFile file) throws IOException {
        return media.uploadDocument(CurrentUser.id(), id, documentType, file.getBytes());
    }

    @GetMapping(value = "/api/media/venues/{venueId}/{fileName}", produces = MediaType.IMAGE_JPEG_VALUE)
    ResponseEntity<byte[]> image(@PathVariable long venueId, @PathVariable String fileName) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable())
                .contentType(MediaType.IMAGE_JPEG)
                .body(media.read(venueId, fileName));
    }
}
