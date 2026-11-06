package com.app.xosbextol.auth;

import com.app.xosbextol.handler.customExceptions.BusinessException;
import com.app.xosbextol.mapper.UserMapper;
import com.app.xosbextol.model.entity.User;
import com.app.xosbextol.model.enums.Role;
import com.app.xosbextol.model.entity.Venue;
import com.app.xosbextol.model.enums.VenueStatus;
import com.app.xosbextol.model.dto.UpdateUserRequestDto;
import com.app.xosbextol.repository.UserDeviceRepository;
import com.app.xosbextol.repository.VenueRepository;
import com.app.xosbextol.repository.cache.VenueCache;
import com.app.xosbextol.service.impl.AuditService;
import com.app.xosbextol.repository.UserRepository;
import com.app.xosbextol.service.impl.UserService;
import org.mapstruct.factory.Mappers;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SocialRegistrationTest {
    private final UserRepository users = mock(UserRepository.class);
    private final VenueRepository venues = mock(VenueRepository.class);
    private final VenueCache venueCache = mock(VenueCache.class);
    private final AuditService audit = mock(AuditService.class);
    private final UserService service = new UserService(users, mock(UserDeviceRepository.class),
            Mappers.getMapper(UserMapper.class), venues, venueCache, audit);

    @Test
    void ownerProfileUpdateNormalizesPhoneAndRoutesDocumentedActiveVenueToReapproval() {
        User owner = new User();
        ReflectionTestUtils.setField(owner, "id", 77L);
        owner.setEmail("owner-profile@example.com");
        owner.setEmailVerifiedAt(Instant.now());
        owner.setRole(Role.VENUE_OWNER);
        owner.setFullName("Şamil Həsənov");
        owner.setPhone("+994501112233");

        Venue venue = new Venue();
        ReflectionTestUtils.setField(venue, "id", 88L);
        venue.setOwner(owner);
        venue.setStatus(VenueStatus.ACTIVE);
        venue.setTaxId("1234567890");
        venue.setFinCode("ABC1234");

        when(users.findById(77L)).thenReturn(Optional.of(owner));
        when(users.findByPhone("+994501234567")).thenReturn(Optional.empty());
        when(venues.findByOwner_Id(77L)).thenReturn(java.util.List.of(venue));

        var profile = service.update(77L, new UpdateUserRequestDto("Samir Həsənov", "az", "+994501234567"));

        assertEquals("Samir Həsənov", profile.getFullName());
        assertEquals("+994501234567", profile.getPhone());
        assertEquals("Samir", owner.getFirstName());
        assertEquals("Həsənov", owner.getLastName());
        assertEquals(VenueStatus.PENDING, venue.getStatus());
        assertEquals("REAPPROVAL_PENDING", venue.getCriticalChangeStatus());
        assertTrue(venue.getCriticalChangeReason().startsWith("OWNER_NAME_CHANGE|"));
        verify(venueCache).changed(88L);
        verify(audit).record(77L, "VENUE_OWNER_NAME_CHANGED", "VENUE", 88L);
    }

    @Test
    void ownerRegistrationAcceptsAndNormalizesAzerbaijaniLocalPhone() {
        when(users.findByEmail("owner@example.com")).thenReturn(Optional.empty());
        when(users.findByPhone("+994776067004")).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            ReflectionTestUtils.setField(user, "id", 51L);
            return user;
        });

        service.register("owner@example.com", "hash", "Şamil", "Həsənov", LocalDate.of(2000, 1, 1),
                "0776067004", Role.VENUE_OWNER.name());

        var saved = (User) mockingDetails(users).getInvocations().stream()
                .filter(invocation -> invocation.getMethod().getName().equals("save"))
                .findFirst().orElseThrow().getArgument(0);
        assertEquals("+994776067004", saved.getPhone());
        assertEquals(Role.VENUE_OWNER, saved.getRole());
    }

    @Test
    void verifiedSocialEmailCreatesAnActiveLinkedAccount() {
        when(users.findByGoogleId("google-subject")).thenReturn(Optional.empty());
        when(users.findByEmail("aysel@example.com")).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            ReflectionTestUtils.setField(user, "id", 42L);
            return user;
        });

        var identity = service.socialIdentity("GOOGLE", "google-subject", " Aysel@Example.com ", true,
                "Aysel", "Məmmədova");

        assertEquals(42L, identity.id());
        assertEquals("aysel@example.com", identity.email());
        var saved = (User) mockingDetails(users).getInvocations().stream()
                .filter(invocation -> invocation.getMethod().getName().equals("save"))
                .findFirst().orElseThrow().getArgument(0);
        assertEquals("google-subject", saved.getGoogleId());
        assertEquals("Aysel Məmmədova", saved.getFullName());
        assertNotNull(saved.getEmailVerifiedAt());
    }

    @Test
    void verifiedProviderCanLinkAnExistingAccountWithTheSameEmail() {
        User existing = new User();
        ReflectionTestUtils.setField(existing, "id", 7L);
        existing.setEmail("user@example.com");
        existing.setEmailVerifiedAt(Instant.now());
        when(users.findByGoogleId("google-subject")).thenReturn(Optional.empty());
        when(users.findByEmail("user@example.com")).thenReturn(Optional.of(existing));
        when(users.save(existing)).thenReturn(existing);

        var identity = service.socialIdentity("GOOGLE", "google-subject", "user@example.com", true,
                null, null);

        assertEquals(7L, identity.id());
        assertEquals("google-subject", existing.getGoogleId());
    }

    @Test
    void unverifiedEmailCannotCreateASocialAccount() {
        when(users.findByGoogleId("google-subject")).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> service.socialIdentity(
                "GOOGLE", "google-subject", "user@example.com", false, "User", null));
        verify(users, never()).save(any());
    }

    @Test
    void unverifiedEmailCannotLinkAnExistingAccount() {
        when(users.findByGoogleId("google-subject")).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> service.socialIdentity(
                "GOOGLE", "google-subject", "existing@example.com", false, "User", null));

        verify(users, never()).findByEmail(anyString());
        verify(users, never()).save(any());
    }
}
