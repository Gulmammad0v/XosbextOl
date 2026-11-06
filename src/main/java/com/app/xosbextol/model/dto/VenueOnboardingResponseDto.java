package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import com.app.xosbextol.model.enums.VenueStatus;
import java.time.Instant;
import java.util.List;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class VenueOnboardingResponseDto {
    long venueId;
    String ownerFullName;
    String ownerEmail;
    String ownerPhone;
    int completionPercent;
    VenueStatus status;
    List<OnboardingRequirementDto> requirements;
    String rejectionReason;
    String criticalChangeStatus;
    String criticalChangeReason;
    List<VenueChangeDto> changes;
    String pendingName;
    String pendingAddress;
    String pendingCity;
    java.math.BigDecimal pendingLatitude;
    java.math.BigDecimal pendingLongitude;
    String legalName;
    String taxId;
    String finCode;
    String companyDocumentUrl;
    String ownerIdentityDocumentUrl;
    String agreementVersion;
    Instant agreementAcceptedAt;
    String agreementSignedBy;
    String companyEditStatus;
    String companyEditRequestMessage;
    Instant companyEditRequestedAt;
    Instant companyEditAllowedUntil;
    Instant companyEditUsedAt;
    String companyEditDecisionReason;
    boolean frozen;
    boolean visible;
}
