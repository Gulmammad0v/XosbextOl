package com.app.xosbextol.service;

import com.app.xosbextol.model.value.UserIdentity;

import com.app.xosbextol.model.value.UserCredential;

import java.time.LocalDate;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.List;
public interface UserAccess {
    boolean exists(String email);

    OptionalLong passwordResetUserId(String email);

    UserIdentity register(String email, String passwordHash, String firstName, String lastName, LocalDate birthDate,
                          String phone, String role);

    Optional<UserCredential> credentials(String email);

    UserIdentity changePassword(String email, String passwordHash);

    UserIdentity requireActive(long id);

    UserIdentity contact(long id);

    Optional<String> activeRole(long id);

    UserIdentity socialIdentity(String provider, String subject, String email, boolean emailVerified,
                                String firstName, String lastName);

    void linkSocial(long userId, String provider, String subject);

    List<String> deviceTokens(long userId);
}
