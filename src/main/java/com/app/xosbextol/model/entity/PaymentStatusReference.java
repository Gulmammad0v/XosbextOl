package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.PaymentStatus;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "payment_statuses")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PaymentStatusReference extends ReferenceValue {
    public PaymentStatusReference(PaymentStatus status) {
        super(status);
    }

    public PaymentStatus value() {
        return asEnum(PaymentStatus.class);
    }
}
