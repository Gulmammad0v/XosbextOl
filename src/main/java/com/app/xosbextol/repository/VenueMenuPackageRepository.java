package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.VenueMenuPackage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VenueMenuPackageRepository extends JpaRepository<VenueMenuPackage, Long> {
    List<VenueMenuPackage> findByVenue_IdAndActiveTrueOrderByTierAsc(long venueId);
    Optional<VenueMenuPackage> findByIdAndVenue_IdAndActiveTrue(long id, long venueId);
    Optional<VenueMenuPackage> findByIdAndVenue_Id(long id, long venueId);
    Optional<VenueMenuPackage> findByVenue_IdAndNameIgnoreCase(long venueId, String name);
    boolean existsByVenue_IdAndActiveTrue(long venueId);
}
