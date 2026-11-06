package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.Amenity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AmenityRepository extends JpaRepository<Amenity, Short> {
    Optional<Amenity> findByCode(String code);
    Optional<Amenity> findByNameAzIgnoreCase(String nameAz);
}
