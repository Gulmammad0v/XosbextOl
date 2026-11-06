package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.VenueStatus;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "venue_statuses")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VenueStatusReference extends ReferenceValue {
    public VenueStatusReference(VenueStatus status) {
        super(status);
    }

    public VenueStatus value() {
        return asEnum(VenueStatus.class);
    }
}
