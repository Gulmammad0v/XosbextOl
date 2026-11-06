package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "amenities")
@Getter
@NoArgsConstructor
public class Amenity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Short id;
    @Column(nullable = false, unique = true, length = 50)
    private String code;
    @Column(nullable = false, length = 100)
    private String nameAz;
    @Column(length = 100)
    private String nameRu;
    @Column(length = 100)
    private String nameEn;
    @Column(length = 100)
    private String icon;

    public Amenity(String code, String nameAz, String nameRu, String nameEn) {
        this.code = code;
        this.nameAz = nameAz;
        this.nameRu = nameRu;
        this.nameEn = nameEn;
    }
}
