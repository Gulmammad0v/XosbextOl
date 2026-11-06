package com.app.xosbextol.repository;

import com.app.xosbextol.model.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    Optional<User> findByGoogleId(String googleId);

    Optional<User> findByPhone(String phone);

    @Query("select u.id from User u where u.roleReference.code = 'ADMIN' and u.statusReference.code = 'ACTIVE'")
    List<Long> findActiveAdminIds();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id=:id")
    Optional<User> lock(long id);
}
