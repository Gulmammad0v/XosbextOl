package com.app.xosbextol.service.impl;

import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.model.entity.Favorite;
import com.app.xosbextol.model.entity.FavoriteId;
import com.app.xosbextol.model.enums.VenueStatus;
import com.app.xosbextol.model.dto.FavoriteVenueResponseDto;
import com.app.xosbextol.repository.FavoriteRepository;
import com.app.xosbextol.repository.UserRepository;
import com.app.xosbextol.repository.VenueRepository;
import com.app.xosbextol.repository.VenueMediaRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class FavoriteService {
    private final FavoriteRepository favorites;
    private final UserRepository users;
    private final VenueRepository venues;
    private final VenueMediaRepository media;

    @Transactional
    public void add(long user, long venue) {
        var venueEntity = venues.findByIdAndStatusReference_Code(venue, VenueStatus.ACTIVE.name())
                .orElseThrow(() -> BusinessException.missing("Zal"));
        var favoriteId = new FavoriteId(user, venue);
        if (!favorites.existsById(favoriteId)) {
            var userEntity = users.findById(user).orElseThrow(() -> BusinessException.missing("İstifadəçi"));
            favorites.save(new Favorite(userEntity, venueEntity));
        }
    }

    @Transactional
    public void remove(long user, long venue) {
        favorites.deleteById(new FavoriteId(user, venue));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> list(long user, int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw BusinessException.invalid("Səhifə ölçüsü 1–100 olmalıdır");
        var result = favorites.findByUser_IdAndVenue_StatusReference_Code(user, VenueStatus.ACTIVE.name(),
                PageRequest.of(page, size, Sort.by("createdAt").descending()));
        var content = result.getContent().stream().map(Favorite::getVenue)
                .map(v -> new FavoriteVenueResponseDto(v.getId(), v.getName(), v.getSlug(), v.getAddress(),
                        media.findFirstByVenue_IdAndHallIsNullAndTypeOrderBySortOrderAscIdAsc(v.getId(), "IMAGE").map(m -> m.getThumbUrl() != null ? m.getThumbUrl() : m.getUrl()).orElse(null),
                        v.getRatingAvg(), v.getRatingCount() == null ? 0 : v.getRatingCount()))
                .toList();
        return Map.of("content", content, "page", page, "size", size, "totalElements", result.getTotalElements());
    }
}
