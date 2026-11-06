package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.Instant;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    Page<AuditLog> findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(Instant from, Instant to, Pageable pageable);
    long deleteByCreatedAtBefore(Instant cutoff);
}
