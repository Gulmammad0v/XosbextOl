package com.app.xosbextol.config.data;

import com.app.xosbextol.model.entity.BookingStatusReference;
import com.app.xosbextol.model.entity.PaymentStatusReference;
import com.app.xosbextol.model.entity.UserRoleReference;
import com.app.xosbextol.model.entity.UserStatusReference;
import com.app.xosbextol.model.entity.VenueStatusReference;
import com.app.xosbextol.model.enums.BookingStatus;
import com.app.xosbextol.model.enums.PaymentStatus;
import com.app.xosbextol.model.enums.Role;
import com.app.xosbextol.model.enums.UserStatus;
import com.app.xosbextol.model.enums.VenueStatus;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(-400)
@RequiredArgsConstructor
public class ReferenceDataInitializer implements ApplicationRunner {
    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (BookingStatus value : BookingStatus.values()) {
            persistIfMissing(BookingStatusReference.class, value.ordinal() + 1,
                    new BookingStatusReference(value));
        }
        for (PaymentStatus value : PaymentStatus.values()) {
            persistIfMissing(PaymentStatusReference.class, value.ordinal() + 1,
                    new PaymentStatusReference(value));
        }
        for (Role value : Role.values()) {
            persistIfMissing(UserRoleReference.class, value.ordinal() + 1,
                    new UserRoleReference(value));
        }
        for (UserStatus value : UserStatus.values()) {
            persistIfMissing(UserStatusReference.class, value.ordinal() + 1,
                    new UserStatusReference(value));
        }
        for (VenueStatus value : VenueStatus.values()) {
            persistIfMissing(VenueStatusReference.class, value.ordinal() + 1,
                    new VenueStatusReference(value));
        }
    }

    private <T> void persistIfMissing(Class<T> type, int id, T value) {
        if (entityManager.find(type, (short) id) == null) {
            entityManager.persist(value);
        }
    }
}
