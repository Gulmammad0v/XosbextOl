package com.app.xosbextol.model.entity;

import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.Getter;

import java.io.Serializable;

@Embeddable @Getter @EqualsAndHashCode @NoArgsConstructor @AllArgsConstructor
public class ReminderDeliveryId implements Serializable {
    private Long bookingId;
    private String reminderType;
}
