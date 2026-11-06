package com.app.xosbextol.model.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Value;
import lombok.experimental.Accessors;
import lombok.extern.jackson.Jacksonized;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Value
@Builder
@Jacksonized
@Accessors(fluent = true)
@AllArgsConstructor
public class VenueLegalRequestDto {
    @NotBlank @Size(max = 200) String legalName;
    @NotBlank @Pattern(regexp = "[0-9]{10}") String taxId;
    @NotBlank @Pattern(regexp = "[A-Z0-9]{7}") String finCode;
    @NotBlank @Size(max = 500) String companyDocumentUrl;
    @NotBlank @Size(max = 500) String ownerIdentityDocumentUrl;
}
