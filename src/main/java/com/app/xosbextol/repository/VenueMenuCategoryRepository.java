package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.VenueMenuCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VenueMenuCategoryRepository extends JpaRepository<VenueMenuCategory, Long> {
    Optional<VenueMenuCategory> findByVenue_IdAndNameIgnoreCase(long venueId, String name);
}
