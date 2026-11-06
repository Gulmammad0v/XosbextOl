package com.app.xosbextol.service.impl;

import com.app.xosbextol.service.VenueAccess;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.model.entity.VenueMedia;
import com.app.xosbextol.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.core.sync.RequestBody;
import net.coobird.thumbnailator.Thumbnails;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import javax.imageio.ImageIO;
import java.io.*;
import java.util.*;
import java.security.*;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Log4j2
public class MediaService {
    private static final Pattern MANAGED_IMAGE_KEY = Pattern.compile(
            "^venues/(\\d+)/([0-9a-fA-F-]{36})-(?:full|medium|thumb)\\.jpg$");

    private final S3Client s3;
    private final VenueAccess venues;
    private final VenueRepository venueRepository;
    private final HallRepository hallRepository;
    private final VenueMediaRepository mediaRepository;
    private final com.app.xosbextol.repository.cache.VenueCache cache;
    private final AuditService audit;
    @Value("${app.storage.bucket}")
    private String bucket;
    @Value("${app.storage.cdn-base-url}")
    private String cdn;

    @Transactional
    public Map<String, Object> upload(long owner, long venueId, Long hallId, byte[] content) {
        venues.assertEditable(venueId, owner);
        if (hallId != null && venues.hall(hallId).venueId() != venueId)
            throw BusinessException.invalid("Zal bu məkana aid deyil");
        long imageCount = hallId == null
                ? mediaRepository.countByVenue_IdAndHallIsNullAndType(venueId, "IMAGE")
                : mediaRepository.countByHall_IdAndType(hallId, "IMAGE");
        if (imageCount >= 10)
            throw BusinessException.conflict(hallId == null
                    ? "Məkan üçün maksimum 10 şəkil əlavə etmək olar"
                    : "Hər zal üçün maksimum 10 şəkil əlavə etmək olar");
        if (content.length == 0 || content.length > 20 * 1024 * 1024)
            throw BusinessException.invalid("Şəkil ölçüsü 1 bayt–20 MB olmalıdır");
        String contentHash = hash(content);
        if (mediaRepository.existsByContentHash(contentHash))
            throw BusinessException.conflict("Bu şəkil artıq başqa restoranda istifadə olunur");
        String prefix = "venues/" + venueId + "/" + UUID.randomUUID();
        String full = prefix + "-full.jpg", medium = prefix + "-medium.jpg", thumb = prefix + "-thumb.jpg";
        List<String> uploaded = new ArrayList<>();
        try {
            var image = verifiedImage(content);
            String[] keys = {full, medium, thumb};
            int[] widths = {2400, 1200, 400};
            for (int i = 0; i < keys.length; i++) {
                var out = new ByteArrayOutputStream();
                Thumbnails.of(image).size(widths[i], widths[i]).outputFormat("jpg").outputQuality(0.85).toOutputStream(out);
                s3.putObject(PutObjectRequest.builder().bucket(bucket).key(keys[i]).contentType("image/jpeg").cacheControl("public,max-age=31536000,immutable").build(), RequestBody.fromBytes(out.toByteArray()));
                uploaded.add(keys[i]);
            }
            VenueMedia value = new VenueMedia();
            value.setVenue(venueRepository.getReferenceById(venueId));
            value.setHall(hallId == null ? null : hallRepository.getReferenceById(hallId));
            value.setType("IMAGE");
            value.setUrl(url(full));
            value.setThumbUrl(url(thumb));
            value.setStorageKey(full);
            value.setSortOrder(0);
            value.setContentHash(contentHash);
            venues.requestReapproval(venueId, owner);
            mediaRepository.saveAndFlush(value);
            cache.changed(venueId);
            audit.record(owner, "VENUE_IMAGE_UPLOADED", "VENUE_MEDIA", value.getId());
            return Map.of("id", value.getId(), "url", url(full), "mediumUrl", url(medium), "thumbUrl", url(thumb));
        } catch (IOException ex) {
            cleanup(uploaded);
            log.warn("Venue image processing failed venueId={} hallId={}", venueId, hallId, ex);
            throw BusinessException.invalid("Şəkil emal edilmədi");
        } catch (RuntimeException ex) {
            cleanup(uploaded);
            throw ex;
        }
    }

    @Transactional
    public void delete(long owner, long venueId, long mediaId) {
        venues.assertEditable(venueId, owner);
        VenueMedia value = mediaRepository.findByIdAndVenue_Id(mediaId, venueId)
                .orElseThrow(() -> BusinessException.missing("Media"));
        Set<String> objectKeys = managedImageKeys(value, venueId);

        venues.requestReapproval(venueId, owner);
        mediaRepository.delete(value);
        mediaRepository.flush();
        deleteManagedObjects(objectKeys, venueId, mediaId);

        cache.changed(venueId);
        audit.record(owner, "VENUE_MEDIA_DELETED", "VENUE_MEDIA", mediaId);
    }

    @Transactional
    public Map<String, Object> uploadDocument(long owner, long venueId, String documentType, byte[] content) {
        venues.assertCompanyDocumentEditable(venueId, owner);
        String normalizedType = documentType.toUpperCase(Locale.ROOT);
        if (!Set.of("COMPANY", "IDENTITY").contains(normalizedType))
            throw BusinessException.invalid("Sənəd növü yanlışdır");
        String key = "venues/" + venueId + "/" + UUID.randomUUID() + "-full.jpg";
        try {
            var image = verifiedImage(content);
            var out = new ByteArrayOutputStream();
            Thumbnails.of(image).size(2400, 2400).outputFormat("jpg").outputQuality(0.9).toOutputStream(out);
            s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType("image/jpeg").cacheControl("private,max-age=31536000,immutable").build(), RequestBody.fromBytes(out.toByteArray()));
            audit.record(owner, "VENUE_" + normalizedType + "_DOCUMENT_UPLOADED", "VENUE", venueId);
            return Map.of("url", url(key));
        } catch (IOException ex) {
            cleanup(List.of(key));
            log.warn("Venue document processing failed venueId={} documentType={}", venueId, normalizedType, ex);
            throw BusinessException.invalid("Sənəd şəkli emal edilmədi");
        } catch (RuntimeException ex) {
            cleanup(List.of(key));
            throw ex;
        }
    }

    private java.awt.image.BufferedImage verifiedImage(byte[] content) throws IOException {
        if (content.length == 0 || content.length > 20 * 1024 * 1024)
            throw BusinessException.invalid("Şəkil ölçüsü 1 bayt–20 MB olmalıdır");
        // Inspect dimensions before decoding to prevent decompression bombs.
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(content))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw BusinessException.invalid("Yalnız JPEG/PNG şəkilləri dəstəklənir");
            var reader = readers.next();
            try {
                if (!Set.of("JPEG", "PNG").contains(reader.getFormatName().toUpperCase(Locale.ROOT)))
                    throw BusinessException.invalid("Yalnız JPEG/PNG şəkilləri dəstəklənir");
                reader.setInput(input);
                if ((long) reader.getWidth(0) * reader.getHeight(0) > 40_000_000)
                    throw BusinessException.invalid("Şəkil 40 megapikseldən böyükdür");
            } finally {
                reader.dispose();
            }
        }
        var image = ImageIO.read(new ByteArrayInputStream(content));
        if (image == null) throw BusinessException.invalid("Şəkil oxunmadı");
        return image;
    }

    private String url(String key) {
        return cdn.replaceAll("/+$", "") + "/" + key;
    }

    private Set<String> managedImageKeys(VenueMedia value, long venueId) {
        String key = value.getStorageKey();
        if ((key == null || key.isBlank()) && value.getContentHash() != null) {
            String baseUrl = cdn.replaceAll("/+$", "") + "/";
            if (value.getUrl().startsWith(baseUrl)) key = value.getUrl().substring(baseUrl.length());
        }
        if (key == null) return Set.of();

        var matcher = MANAGED_IMAGE_KEY.matcher(key);
        if (!matcher.matches() || Long.parseLong(matcher.group(1)) != venueId) {
            log.warn("Ignoring invalid managed media storage key venueId={} mediaId={} objectKey={}",
                    venueId, value.getId(), key);
            return Set.of();
        }
        String prefix = "venues/" + venueId + "/" + matcher.group(2);
        return new LinkedHashSet<>(List.of(
                prefix + "-full.jpg",
                prefix + "-medium.jpg",
                prefix + "-thumb.jpg"));
    }

    private void deleteManagedObjects(Set<String> objectKeys, long venueId, long mediaId) {
        if (objectKeys.isEmpty()) return;
        try {
            var objects = objectKeys.stream()
                    .map(key -> ObjectIdentifier.builder().key(key).build())
                    .toList();
            DeleteObjectsResponse response = s3.deleteObjects(DeleteObjectsRequest.builder()
                    .bucket(bucket)
                    .delete(Delete.builder().objects(objects).quiet(true).build())
                    .build());
            if (response != null && !response.errors().isEmpty()) {
                throw new IllegalStateException("Storage rejected one or more object deletions");
            }
        } catch (RuntimeException ex) {
            log.error("Venue media storage deletion failed venueId={} mediaId={}", venueId, mediaId, ex);
            throw new BusinessException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "Şəkil yaddaşdan silinmədi. Bir qədər sonra yenidən sınayın.");
        }
    }

    public byte[] read(long venueId, String fileName) {
        if (!fileName.matches("[0-9a-fA-F-]{36}-(full|medium|thumb)\\.jpg"))
            throw BusinessException.missing("Şəkil");
        String key = "venues/" + venueId + "/" + fileName;
        try {
            return s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build()).asByteArray();
        } catch (NoSuchKeyException ex) {
            throw BusinessException.missing("Şəkil");
        } catch (S3Exception ex) {
            if (ex.statusCode() == 404) throw BusinessException.missing("Şəkil");
            throw ex;
        }
    }

    private String hash(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private void cleanup(List<String> keys) {
        for (String key : keys) {
            try {
                s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
            } catch (RuntimeException ex) {
                log.warn("Storage cleanup failed objectKey={}", key, ex);
            }
        }
    }
}
