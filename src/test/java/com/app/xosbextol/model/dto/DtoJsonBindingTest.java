package com.app.xosbextol.model.dto;

import com.app.xosbextol.client.payment.PaymentGatewaySession;
import com.app.xosbextol.model.value.OccupiedBookingSlot;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DtoJsonBindingTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void bindsRequestDtoWithFluentLombokAccessors() throws Exception {
        var request = mapper.readValue("""
                {"email":" User@Example.com ","password":"Secure123!","deviceName":"Pixel 9","deviceId":"device-1234567890","platform":"ANDROID","osVersion":"16","appVersion":"1.0.0"}
                """, LoginRequestDto.class);

        assertEquals("user@example.com", request.getEmail());
        assertEquals("Secure123!", request.getPassword());
        assertEquals("Pixel 9", request.getDeviceName());
        assertEquals("ANDROID", request.getPlatform());
        assertEquals("device-1234567890", request.getDeviceId());
    }

    @Test
    void bindsAdminLoginWithoutDeviceData() throws Exception {
        var request = mapper.readValue("""
                {"email":" Admin@Example.com ","password":"Secure123!"}
                """, AdminLoginRequestDto.class);

        assertEquals("admin@example.com", request.getEmail());
        assertEquals("Secure123!", request.getPassword());
    }

    @Test
    void bindsSocialChallengeProvider() throws Exception {
        var request = mapper.readValue("""
                {"provider":"GOOGLE"}
                """, SocialChallengeRequestDto.class);

        assertEquals("GOOGLE", request.provider());
    }

    @Test
    void bindsSocialLoginPayload() throws Exception {
        var request = mapper.readValue("""
                {
                  "provider":"GOOGLE",
                  "idToken":"identity-token",
                  "challenge":"challenge-token",
                  "deviceName":"iPhone 15",
                  "deviceId":"device-1234567890",
                  "platform":"IOS",
                  "osVersion":"18",
                  "appVersion":"1.0.0",
                  "firstName":"Ali",
                  "lastName":"Gulmammadov"
                }
                """, SocialLoginRequestDto.class);

        assertEquals("GOOGLE", request.provider());
        assertEquals("identity-token", request.idToken());
        assertEquals("challenge-token", request.challenge());
        assertEquals("iPhone 15", request.deviceName());
        assertEquals("IOS", request.platform());
        assertEquals("device-1234567890", request.deviceId());
        assertEquals("Ali", request.firstName());
        assertEquals("Gulmammadov", request.lastName());
    }

    @Test
    void serializesResponseDtoWithOriginalJsonPropertyNames() throws Exception {
        var response = new TokenResponseDto("access", "refresh", 900, "Bearer");
        var json = mapper.readTree(mapper.writeValueAsString(response));

        assertEquals("access", json.get("accessToken").asText());
        assertEquals("refresh", json.get("refreshToken").asText());
        assertEquals(900, json.get("expiresIn").asLong());
        assertEquals("Bearer", json.get("tokenType").asText());
    }

    @Test
    void serializesFormerRecordResponseWithOriginalJsonPropertyNames() throws Exception {
        var response = new AgreementResponseDto("v1", "Terms", "Content", true);
        var json = mapper.readTree(mapper.writeValueAsString(response));

        assertEquals("v1", json.get("version").asText());
        assertEquals("Terms", json.get("title").asText());
        assertEquals("Content", json.get("content").asText());
        assertEquals(true, json.get("testDocument").asBoolean());
    }

    @Test
    void bindsPaymentGatewayResponseClass() throws Exception {
        var session = mapper.readValue("""
                {"transactionId":"tx-1","checkoutUrl":"https://payments.example/tx-1"}
                """, PaymentGatewaySession.class);

        assertEquals("tx-1", session.transactionId());
        assertEquals("https://payments.example/tx-1", session.checkoutUrl());
    }

    @Test
    void serializesOccupiedBookingDateForTheCalendar() throws Exception {
        var slot = new OccupiedBookingSlot(LocalDate.of(2026, 12, 20), "CONFIRMED");
        var json = mapper.readTree(mapper.writeValueAsString(slot));

        assertEquals("2026-12-20", json.get("date").asText());
        assertEquals("CONFIRMED", json.get("status").asText());
    }

    @Test
    void bindsMenuCategoryDefaults() throws Exception {
        var category = mapper.readValue("""
                {
                  "name":"Soyuq qəlyanaltılar",
                  "sortOrder":1,
                  "defaultCustomizable":true,
                  "defaultPricePerPerson":2,
                  "items":[{
                    "name":"Kərə yağı",
                    "seasonal":false,
                    "customizable":true,
                    "additionalPricePerPerson":2
                  }]
                }
                """, MenuCategoryRequestDto.class);

        assertEquals(true, category.defaultCustomizable());
        assertEquals(new BigDecimal("2"), category.defaultPricePerPerson());
        assertEquals(1, category.items().size());
    }
}
