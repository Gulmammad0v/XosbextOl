package com.app.xosbextol.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@MappedSuperclass
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public abstract class ReferenceValue {
    @Id
    private Short id;

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    protected ReferenceValue(Enum<?> value) {
        this.id = (short) (value.ordinal() + 1);
        this.code = value.name();
    }

    protected <E extends Enum<E>> E asEnum(Class<E> type) {
        return Enum.valueOf(type, code);
    }
}
