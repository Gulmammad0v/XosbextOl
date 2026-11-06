package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.HallBlockedDate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;

public interface HallBlockedDateRepository extends JpaRepository<HallBlockedDate, Long> {
    List<HallBlockedDate> findByHall_IdOrderByBlockedDate(long hallId);
    List<HallBlockedDate> findByHall_IdAndBlockedDateBetweenOrderByBlockedDate(long hallId, LocalDate from, LocalDate to);

    @Query("select distinct d.hall.id from HallBlockedDate d where d.blockedDate = :date")
    List<Long> unavailableHallIds(LocalDate date);

    boolean existsByHall_IdAndBlockedDate(long hallId, LocalDate date);
}
