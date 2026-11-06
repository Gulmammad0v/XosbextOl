package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.entity.PromoCode;
import com.app.xosbextol.model.dto.PromoRequestDto;
import com.app.xosbextol.model.dto.PromoResponseDto;
import com.app.xosbextol.repository.PromoCodeRepository;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.service.impl.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import lombok.RequiredArgsConstructor;
import java.util.Map;
@Service @RequiredArgsConstructor
public class PromoService {
    private final PromoCodeRepository promos;
    private final AuditService audit;
    public Map<String,Object> list(int page,int size) {
        if(page<0 || size<1 || size>100) throw BusinessException.invalid("Səhifə ölçüsü 1–100 olmalıdır");
        var result = promos.findAll(PageRequest.of(page, size, Sort.by("id").descending()));
        return Map.of("content", result.getContent().stream().map(this::response).toList(), "page", page, "size", size,
            "totalElements", result.getTotalElements());
    }
    @Transactional public long create(long admin,PromoRequestDto req) {
        validate(req);
        var promo = new PromoCode();
        apply(promo, req);
        long id = promos.saveAndFlush(promo).getId();
        audit.record(admin,"PROMO_CREATED","PROMO",id);return id;
    }
    @Transactional public void update(long admin,long id,PromoRequestDto req) {
        validate(req);
        var promo = promos.lockById(id).orElseThrow(() -> BusinessException.missing("Promo kod"));
        apply(promo, req);
        audit.record(admin,"PROMO_UPDATED","PROMO",id);
    }
    @Transactional public void setActive(long admin, long id, boolean active) {
        var promo = promos.lockById(id).orElseThrow(() -> BusinessException.missing("Promo kod"));
        promo.setActive(active);
        audit.record(admin, active ? "PROMO_ACTIVATED" : "PROMO_DEACTIVATED", "PROMO", id);
    }
    private void validate(PromoRequestDto r) {
        if("PERCENT".equals(r.getDiscountType()) && r.getDiscountValue().compareTo(new java.math.BigDecimal("100"))>0 || r.getValidFrom()!=null && r.getValidTo()!=null && !r.getValidTo().isAfter(r.getValidFrom()))
            throw BusinessException.invalid("Promo kod aralığı yanlışdır");
    }
    private void apply(PromoCode promo, PromoRequestDto request) {
        promo.setCode(request.getCode()); promo.setDiscountType(request.getDiscountType());
        promo.setDiscountValue(request.getDiscountValue()); promo.setMaxUses(request.getMaxUses());
        promo.setValidFrom(request.getValidFrom()); promo.setValidTo(request.getValidTo()); promo.setActive(request.isActive());
    }
    private PromoResponseDto response(PromoCode p) {
        return new PromoResponseDto(p.getId(), p.getCode(), p.getDiscountType(), p.getDiscountValue(), p.getMaxUses(),
                p.getUsedCount(), p.getValidFrom(), p.getValidTo(), p.getActive());
    }
}
