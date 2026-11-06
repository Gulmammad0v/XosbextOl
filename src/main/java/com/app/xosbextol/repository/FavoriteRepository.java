package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.Favorite;
import com.app.xosbextol.model.entity.FavoriteId;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FavoriteRepository extends JpaRepository<Favorite, FavoriteId> {
    Page<Favorite> findByUser_IdAndVenue_StatusReference_Code(Long userId, String status, Pageable pageable);
}
