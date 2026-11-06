package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.ExtraService;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExtraServiceRepository extends JpaRepository<ExtraService, Long> {
    Optional<ExtraService> findByIdAndVenue_IdAndActiveTrue(long id, long venueId);
    Optional<ExtraService> findByIdAndVenue_Id(long id, long venueId);
    List<ExtraService> findByVenue_IdAndActiveTrueOrderById(long venueId);
    List<ExtraService> findByVenue_IdOrderById(long venueId);
    boolean existsByVenue_IdAndNameIgnoreCase(long venueId, String name);
}
