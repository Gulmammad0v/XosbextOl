package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.UserStatus;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_statuses")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserStatusReference extends ReferenceValue {
    public UserStatusReference(UserStatus status) {
        super(status);
    }

    public UserStatus value() {
        return asEnum(UserStatus.class);
    }
}
