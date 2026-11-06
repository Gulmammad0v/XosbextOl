package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.VenueMenuItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface VenueMenuItemRepository extends JpaRepository<VenueMenuItem, Long> {
    List<VenueMenuItem> findByIdInAndCategory_Venue_IdAndActiveTrue(Collection<Long> ids, long venueId);
    Optional<VenueMenuItem> findByCategory_IdAndNameIgnoreCase(long categoryId, String name);
}
