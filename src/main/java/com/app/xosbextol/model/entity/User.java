package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.enums.Role;
import com.app.xosbextol.model.enums.UserStatus;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "users")
@org.hibernate.annotations.Check(constraints = "email = lower(trim(email)) and email <> '' and preferred_lang in ('az', 'en', 'ru')")
@Getter
@Setter
@NoArgsConstructor
public class User extends BaseEntity {
    @Column(nullable = false, unique = true, length = 254)
    private String email;
    @Column(unique = true, length = 20)
    private String phone;
    private java.time.Instant emailVerifiedAt;
    @Column()
    private String passwordHash;
    @Column(length = 75)
    private String firstName;
    @Column(length = 75)
    private String lastName;
    private LocalDate birthDate;
    @Column(length = 150)
    private String fullName;
    @Column(length = 500)
    private String avatarUrl;
    @ManyToOne
    @JoinColumn(name = "role_id")
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private UserRoleReference roleReference = new UserRoleReference(Role.CUSTOMER);
    @ManyToOne(optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    @Getter(AccessLevel.NONE)
    @Setter(AccessLevel.NONE)
    private UserStatusReference statusReference = new UserStatusReference(UserStatus.ACTIVE);
    @Column(length = 5)
    private String preferredLang = "az";
    @Column(unique = true, length = 100)
    private String googleId;

    public Role getRole() {
        return roleReference == null ? null : roleReference.value();
    }

    public void setRole(Role role) {
        roleReference = new UserRoleReference(java.util.Objects.requireNonNull(role));
    }

    public UserStatus getStatus() {
        return statusReference == null ? null : statusReference.value();
    }

    public void setStatus(UserStatus status) {
        statusReference = new UserStatusReference(java.util.Objects.requireNonNull(status));
    }
}
