package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.entity.PromoCode;
import com.app.xosbextol.repository.PromoCodeRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.*;

class PromoServiceTest {
    @Test
    void adminCanDeactivatePromoDirectly() {
        PromoCodeRepository promos = mock(PromoCodeRepository.class);
        AuditService audit = mock(AuditService.class);
        PromoService service = new PromoService(promos, audit);
        PromoCode promo = new PromoCode();
        promo.setId(7L);
        promo.setActive(true);
        when(promos.lockById(7L)).thenReturn(Optional.of(promo));

        service.setActive(3L, 7L, false);

        assertFalse(promo.getActive());
        verify(audit).record(3L, "PROMO_DEACTIVATED", "PROMO", 7L);
    }
}
