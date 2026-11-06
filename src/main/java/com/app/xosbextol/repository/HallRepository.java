package com.app.xosbextol.repository;
import com.app.xosbextol.model.entity.VenueHall;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface HallRepository extends JpaRepository<VenueHall,Long> {
    List<VenueHall> findByVenue_IdAndActiveTrue(long venueId);
    List<VenueHall> findByVenue_Id(long venueId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select h from VenueHall h where h.id=:id")
    Optional<VenueHall> lock(long id);
}
