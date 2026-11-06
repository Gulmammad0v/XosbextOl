package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.BookingStatus;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "booking_statuses")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BookingStatusReference extends ReferenceValue {
    public BookingStatusReference(BookingStatus status) {
        super(status);
    }

    public BookingStatus value() {
        return asEnum(BookingStatus.class);
    }
}
