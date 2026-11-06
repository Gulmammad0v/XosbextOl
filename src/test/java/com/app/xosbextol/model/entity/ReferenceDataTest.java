package com.app.xosbextol.model.entity;

import com.app.xosbextol.model.constant.AzerbaijanCities;
import com.app.xosbextol.model.enums.BookingStatus;
import com.app.xosbextol.model.enums.PaymentStatus;
import com.app.xosbextol.model.enums.Role;

import org.junit.jupiter.api.Test;

import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReferenceDataTest {
    @Test
    void mapsLookupRowsToValueFreeEnums() {
        var booking = new BookingStatusReference(BookingStatus.COMPLETED);
        var payment = new PaymentStatusReference(PaymentStatus.SUCCESS);
        var role = new UserRoleReference(Role.VENUE_OWNER);

        assertEquals("COMPLETED", booking.getCode());
        assertEquals(BookingStatus.COMPLETED, booking.value());
        assertEquals("SUCCESS", payment.getCode());
        assertEquals(PaymentStatus.SUCCESS, payment.value());
        assertEquals("VENUE_OWNER", role.getCode());
        assertEquals(Role.VENUE_OWNER, role.value());
    }

    @Test
    void exposesOnlyTheSupportedCityCatalog() {
        var pattern = Pattern.compile(AzerbaijanCities.PATTERN);

        assertEquals(80, AzerbaijanCities.VALUES.size());
        assertTrue(AzerbaijanCities.VALUES.stream().allMatch(city -> pattern.matcher(city).matches()));
        assertTrue(AzerbaijanCities.contains("Bakı"));
        assertFalse(AzerbaijanCities.contains("Binəqədi"));
    }
}
