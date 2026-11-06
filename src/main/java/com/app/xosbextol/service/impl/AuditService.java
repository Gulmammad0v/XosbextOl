package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.entity.AuditLog;
import com.app.xosbextol.repository.AuditLogRepository;
import com.app.xosbextol.repository.UserRepository;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import java.time.Clock;
import java.time.ZonedDateTime;
@Service @RequiredArgsConstructor @Log4j2
public class AuditService {
    private final AuditLogRepository audits;
    private final UserRepository users;
    private final Clock clock;
    public void record(Long actor, String action, String entity, Long id) {
        var audit = new AuditLog();
        if (actor != null) audit.setActor(users.getReferenceById(actor));
        audit.setAction(action);
        audit.setEntityType(entity);
        audit.setEntityId(id);
        audits.save(audit);
        log.info("Audit event recorded actorId={} action={} entityType={} entityId={}", actor, action, entity, id);
    }

    @Transactional
    public long deleteExpired() {
        return audits.deleteByCreatedAtBefore(ZonedDateTime.now(clock).minusMonths(1).toInstant());
    }
}
