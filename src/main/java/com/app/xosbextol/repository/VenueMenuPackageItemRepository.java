package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.VenueMenuPackageItem;
import org.springframework.data.jpa.repository.*;

import java.util.List;

public interface VenueMenuPackageItemRepository extends JpaRepository<VenueMenuPackageItem, Long> {
    @Query("select pi from VenueMenuPackageItem pi join fetch pi.menuItem item join fetch item.category where pi.menuPackage.id in :packageIds order by pi.menuPackage.tier, item.category.sortOrder, item.id")
    List<VenueMenuPackageItem> findDetailedByPackageIds(List<Long> packageIds);

    List<VenueMenuPackageItem> findByMenuPackage_Id(long packageId);

    boolean existsByMenuPackage_Venue_IdAndMenuPackage_ActiveTrue(long venueId);

    boolean existsByMenuItem_IdAndMenuPackage_Venue_IdAndMenuPackage_TierGreaterThanAndMenuPackage_ActiveTrue(long itemId, long venueId, int tier);
}
