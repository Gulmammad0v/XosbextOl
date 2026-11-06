package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.VenueMedia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface VenueMediaRepository extends JpaRepository<VenueMedia, Long> {
    List<VenueMedia> findByVenue_IdOrderBySortOrderAscIdAsc(long venueId);

    Optional<VenueMedia> findFirstByVenue_IdAndHallIsNullAndTypeOrderBySortOrderAscIdAsc(long venueId, String type);

    Optional<VenueMedia> findByIdAndVenue_Id(long id, long venueId);

    boolean existsByContentHash(String contentHash);

    long countByVenue_IdAndHallIsNullAndType(long venueId, String type);

    long countByHall_IdAndType(long hallId, String type);

    boolean existsByHall_IdAndType(long hallId, String type);
}
