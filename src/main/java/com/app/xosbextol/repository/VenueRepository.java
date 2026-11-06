package com.app.xosbextol.repository;
import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;
public interface VenueRepository extends JpaRepository<Venue,Long>,JpaSpecificationExecutor<Venue> {
    Page<Venue> findByOwner_Id(long ownerId,Pageable page);
    List<Venue> findByOwner_Id(long ownerId);
    Optional<Venue> findBySlugAndStatusReference_Code(String slug,String status);
    boolean existsBySlug(String slug);
    Optional<Venue> findByIdAndStatusReference_Code(long id, String status);
    @Query("select count(v) > 0 from Venue v where v.id <> :id and lower(trim(v.address)) = lower(trim(:address))")
    boolean existsDuplicateAddress(long id, String address);
    Page<Venue> findByStatusReference_Code(String status, Pageable page);
    @Query("select v.statusReference.code, count(v) from Venue v group by v.statusReference.code")
    java.util.List<Object[]> countByStatus();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select v from Venue v where v.id=:id")
    Optional<Venue> lock(long id);
}
