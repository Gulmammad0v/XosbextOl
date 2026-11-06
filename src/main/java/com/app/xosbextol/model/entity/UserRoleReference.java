package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.Role;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_roles")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserRoleReference extends ReferenceValue {
    public UserRoleReference(Role role) {
        super(role);
    }

    public Role value() {
        return asEnum(Role.class);
    }
}
