package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.value.UserIdentity;

import com.app.xosbextol.model.value.UserCredential;

import com.app.xosbextol.service.*;
import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import com.app.xosbextol.model.dto.*;
import com.app.xosbextol.repository.UserDeviceRepository;
import com.app.xosbextol.repository.UserRepository;
import com.app.xosbextol.repository.VenueRepository;
import com.app.xosbextol.repository.cache.VenueCache;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;

import java.time.*;
import java.util.Optional;
import java.util.OptionalLong;

@Service
@RequiredArgsConstructor
public class UserService implements UserAccess {
    private final UserRepository repo;
    private final UserDeviceRepository userDevices;
    private final com.app.xosbextol.mapper.UserMapper mapper;
    private final VenueRepository venues;
    private final VenueCache venueCache;
    private final AuditService audit;

    private static final String OWNER_NAME_CHANGE_PREFIX = "OWNER_NAME_CHANGE|";

    @Transactional(readOnly = true)
    public boolean exists(String email) {
        return repo.findByEmail(com.app.xosbextol.util.EmailAddress.normalize(email)).isPresent();
    }

    @Transactional(readOnly = true)
    public OptionalLong passwordResetUserId(String email) {
        return repo.findByEmail(com.app.xosbextol.util.EmailAddress.normalize(email))
                .filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .map(user -> OptionalLong.of(user.getId()))
                .orElseGet(OptionalLong::empty);
    }

    @Transactional
    public UserIdentity register(String email, String passwordHash, String firstName, String lastName, LocalDate birthDate,
                                 String phone, String requestedRole) {
        String normalized = com.app.xosbextol.util.EmailAddress.normalize(email);
        if (repo.findByEmail(normalized).isPresent())
            throw BusinessException.conflict("Bu email ilə hesab artıq mövcuddur");
        Role role;
        try {
            role = Role.valueOf(requestedRole);
        } catch (RuntimeException ex) {
            throw BusinessException.invalid("Hesab növü yanlışdır");
        }
        if (role == Role.ADMIN) throw BusinessException.invalid("Admin hesabı qeydiyyatdan yaradıla bilməz");
        String normalizedPhone = normalizePhone(phone);
        if (role == Role.VENUE_OWNER && (normalizedPhone == null || normalizedPhone.isBlank()))
            throw BusinessException.invalid("Restoran sahibi üçün telefon nömrəsi mütləqdir");
        if (normalizedPhone != null && repo.findByPhone(normalizedPhone).isPresent())
            throw BusinessException.conflict("Bu telefon nömrəsi ilə hesab artıq mövcuddur");
        var user = new User();
        user.setEmail(normalized);
        user.setEmailVerifiedAt(Instant.now());
        user.setPasswordHash(passwordHash);
        user.setFirstName(firstName.trim());
        user.setLastName(lastName.trim());
        user.setFullName(user.getFirstName() + " " + user.getLastName());
        user.setBirthDate(birthDate);
        user.setPhone(normalizedPhone);
        user.setRole(role);
        return identity(repo.save(user));
    }

    @Transactional(readOnly = true)
    public Optional<UserCredential> credentials(String email) {
        return repo.findByEmail(com.app.xosbextol.util.EmailAddress.normalize(email))
                .filter(u -> u.getStatus() == UserStatus.ACTIVE && u.getEmailVerifiedAt() != null)
                .map(u -> new UserCredential(identity(u), u.getPasswordHash()));
    }

    @Transactional
    public UserIdentity changePassword(String email, String passwordHash) {
        var user = repo.findByEmail(com.app.xosbextol.util.EmailAddress.normalize(email)).orElseThrow(() -> BusinessException.missing("İstifadəçi"));
        if (user.getStatus() != UserStatus.ACTIVE) throw BusinessException.forbidden();
        if (user.getEmailVerifiedAt() == null) user.setEmailVerifiedAt(Instant.now());
        user.setPasswordHash(passwordHash);
        return identity(user);
    }

    @Transactional(readOnly = true)
    public UserIdentity requireActive(long id) {
        return identity(active(require(id)));
    }

    @Transactional(readOnly = true)
    public UserIdentity contact(long id) {
        return identity(require(id));
    }

    @Transactional(readOnly = true)
    public Optional<String> activeRole(long id) {
        return repo.findById(id).filter(u -> u.getStatus() == UserStatus.ACTIVE && u.getEmailVerifiedAt() != null).map(u -> u.getRole().name());
    }

    @Transactional
    public UserIdentity socialIdentity(String provider, String subject, String email, boolean emailVerified,
                                       String firstName, String lastName) {
        var socialUser = socialUser(provider,subject);
        if (socialUser.isPresent()) return identity(active(socialUser.get()));
        if (!emailVerified || email == null || email.isBlank())
            throw BusinessException.invalid("Sosial hesab təsdiqlənmiş email ünvanı vermədi");

        String normalized = com.app.xosbextol.util.EmailAddress.normalize(email);
        int at = normalized.indexOf('@');
        if (normalized.length() > 254 || at < 1 || at == normalized.length() - 1)
            throw BusinessException.invalid("Sosial hesabın email ünvanı yanlışdır");
        var user = repo.findByEmail(normalized).map(this::active).orElseGet(() -> {
            var created = new User();
            created.setEmail(normalized);
            created.setEmailVerifiedAt(Instant.now());
            created.setFirstName(cleanName(firstName));
            created.setLastName(cleanName(lastName));
            created.setFullName(fullName(created.getFirstName(), created.getLastName(), normalized));
            return created;
        });
        String current = socialSubject(user, provider);
        if (current != null && !current.equals(subject))
            throw BusinessException.conflict("Bu email başqa sosial hesaba bağlıdır");
        setSocialSubject(user, provider, subject);
        return identity(repo.save(user));
    }

    @Transactional
    public void linkSocial(long userId, String provider, String subject) {
        var user=active(repo.lock(userId).orElseThrow(()->BusinessException.missing("İstifadəçi")));
        String current=socialSubject(user,provider);
        if (current != null && !current.equals(subject))
            throw BusinessException.conflict("Başqa sosial hesab artıq əlaqələndirilib");
        setSocialSubject(user, provider, subject);
    }

    private Optional<User> socialUser(String provider,String subject) {
        if (!"GOOGLE".equals(provider)) throw BusinessException.invalid("Sosial provider yanlışdır");
        return repo.findByGoogleId(subject);
    }
    private String socialSubject(User user,String provider) {
        if (!"GOOGLE".equals(provider)) throw BusinessException.invalid("Sosial provider yanlışdır");
        return user.getGoogleId();
    }
    private void setSocialSubject(User user, String provider, String subject) {
        if (!"GOOGLE".equals(provider)) throw BusinessException.invalid("Sosial provider yanlışdır");
        user.setGoogleId(subject);
    }
    private String cleanName(String value) {
        if (value == null || value.isBlank()) return null;
        String cleaned = value.strip();
        return cleaned.length() <= 75 ? cleaned : cleaned.substring(0, 75);
    }
    private String normalizePhone(String value) {
        if (value == null || value.isBlank()) return null;
        String compact = value.replaceAll("[\\s()-]", "");
        if (compact.matches("0[0-9]{9}")) return "+994" + compact.substring(1);
        if (compact.matches("994[0-9]{9}")) return "+" + compact;
        return compact;
    }
    private String fullName(String firstName, String lastName, String email) {
        String joined = java.util.stream.Stream.of(firstName, lastName)
                .filter(java.util.Objects::nonNull).collect(java.util.stream.Collectors.joining(" "));
        String value = joined.isBlank() ? email.substring(0, email.indexOf('@')) : joined;
        return value.length() <= 150 ? value : value.substring(0, 150);
    }

    @Transactional(readOnly = true)
    public UserProfileResponseDto profile(long id) {
        return profileOf(require(id));
    }

    @Transactional
    public UserProfileResponseDto update(long id, UpdateUserRequestDto request) {
        var u = active(require(id));
        String oldName = u.getFullName();
        String newName = request.getFullName().strip();
        String normalizedPhone = request.getPhone() == null ? u.getPhone() : normalizeAzerbaijanPhone(request.getPhone());
        if (!java.util.Objects.equals(normalizedPhone, u.getPhone())) {
            repo.findByPhone(normalizedPhone)
                    .filter(existing -> !java.util.Objects.equals(existing.getId(), u.getId()))
                    .ifPresent(existing -> { throw BusinessException.conflict("Bu telefon nömrəsi ilə hesab artıq mövcuddur"); });
            u.setPhone(normalizedPhone);
        }
        u.setFullName(newName);
        syncNameParts(u, newName);
        u.setPreferredLang(request.getLanguage());
        if (u.getRole() == Role.VENUE_OWNER && !java.util.Objects.equals(oldName, newName)) {
            requestOwnerNameReapproval(u.getId(), oldName, newName);
        }
        return profileOf(u);
    }

    @Transactional
    public UserProfileResponseDto updateLanguage(long id, String language) {
        var user = active(require(id));
        user.setPreferredLang(language);
        return profileOf(user);
    }

    private String normalizeAzerbaijanPhone(String value) {
        String digits = value.replaceAll("[^0-9]", "");
        if (digits.startsWith("994")) digits = digits.substring(3);
        if (digits.length() != 9) throw BusinessException.invalid("Telefon nömrəsi 9 rəqəmdən ibarət olmalıdır");
        return "+994" + digits;
    }

    private void syncNameParts(User user, String fullName) {
        int separator = fullName.indexOf(' ');
        if (separator < 0) {
            user.setFirstName(fullName);
            user.setLastName(null);
            return;
        }
        user.setFirstName(fullName.substring(0, separator).strip());
        user.setLastName(fullName.substring(separator + 1).strip());
    }

    private void requestOwnerNameReapproval(long ownerId, String oldName, String newName) {
        venues.findByOwner_Id(ownerId).stream()
                .filter(venue -> venue.getStatus() == VenueStatus.ACTIVE || "REAPPROVAL_PENDING".equals(venue.getCriticalChangeStatus()))
                .filter(venue -> present(venue.getTaxId()) && present(venue.getFinCode()))
                .forEach(venue -> {
                    venue.setStatus(VenueStatus.PENDING);
                    venue.setSubmittedAt(Instant.now());
                    venue.setRejectionReason(null);
                    venue.setCriticalChangeStatus("REAPPROVAL_PENDING");
                    venue.setCriticalChangeReason(ownerNameChange(venue.getCriticalChangeReason(), oldName, newName));
                    venueCache.changed(venue.getId());
                    audit.record(ownerId, "VENUE_OWNER_NAME_CHANGED", "VENUE", venue.getId());
                });
    }

    private String ownerNameChange(String existingReason, String oldName, String newName) {
        String encodedOldName = java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(java.util.Objects.toString(oldName, "").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        if (existingReason != null && existingReason.startsWith(OWNER_NAME_CHANGE_PREFIX)) {
            String[] existingParts = existingReason.substring(OWNER_NAME_CHANGE_PREFIX.length()).split("\\|", -1);
            if (existingParts.length == 2) encodedOldName = existingParts[0];
        }
        return OWNER_NAME_CHANGE_PREFIX + encodedOldName
                + "|" + java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(newName.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private boolean present(String value) {
        return value != null && !value.isBlank();
    }

    @Transactional
    public void registerDevice(long userId, Long currentDeviceId, DeviceTokenRequestDto request) {
        if (currentDeviceId == null) throw BusinessException.invalid("Cari cihaz müəyyən edilmədi");
        var device = userDevices.findByIdAndUser_Id(currentDeviceId, userId)
                .orElseThrow(() -> BusinessException.missing("Cihaz"));
        userDevices.clearFcmTokenFromOtherDevices(request.getToken(), device.getId());
        device.setFcmToken(request.getToken());
        device.setPlatform(request.getPlatform());
        device.setLastActiveAt(Instant.now());
    }

    @Transactional(readOnly = true)
    public java.util.List<String> deviceTokens(long userId) {
        return userDevices.findByUser_IdAndStatusAndFcmTokenIsNotNull(userId, DeviceStatus.ACTIVE).stream()
                .map(UserDevice::getFcmToken).toList();
    }

    private User require(long id) {
        return repo.findById(id).orElseThrow(() -> BusinessException.missing("İstifadəçi"));
    }

    private User active(User u) {
        if (u.getStatus() != UserStatus.ACTIVE || u.getEmailVerifiedAt() == null) throw BusinessException.forbidden();
        return u;
    }

    private UserIdentity identity(User u) {
        return new UserIdentity(u.getId(), u.getEmail(), u.getRole().name(), u.getPreferredLang());
    }

    private UserProfileResponseDto profileOf(User u) {
        return mapper.profile(u);
    }
}
