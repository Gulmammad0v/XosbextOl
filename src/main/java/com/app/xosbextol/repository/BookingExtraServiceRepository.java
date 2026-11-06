package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.BookingExtraService;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingExtraServiceRepository extends JpaRepository<BookingExtraService, Long> {
    boolean existsByService_Id(long serviceId);
}
