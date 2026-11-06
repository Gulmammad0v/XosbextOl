package com.app.xosbextol.booking;
import com.app.xosbextol.service.impl.BookingPriceCalculator;
import com.app.xosbextol.service.VenueAccess;
import com.app.xosbextol.model.value.VenueHallSnapshot;
import com.app.xosbextol.model.value.VenueExtraSnapshot;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
class BookingPriceCalculatorTest {
    @Test void serverPriceIncludesPerGuestExtrasAndCapsDiscount() {
        var hall=new VenueHallSnapshot(1,1,1,50,500,new BigDecimal("50"),new BigDecimal("30"));
        var extras=List.of(new VenueExtraSnapshot(1,"photo",new BigDecimal("250"),false),new VenueExtraSnapshot(2,"menu",new BigDecimal("5"),true));
        var price=new BookingPriceCalculator().calculate(hall,100,extras,new BigDecimal("1000"));
        assertEquals(new BigDecimal("5000.00"),price.hall());
        assertEquals(new BigDecimal("750.00"),price.services());
        assertEquals(new BigDecimal("4750.00"),price.total());
        assertEquals(new BigDecimal("100.00"),price.deposit());
        var free=new BookingPriceCalculator().calculate(hall,100,extras,new BigDecimal("99999"));
        assertEquals(new BigDecimal("0.00"),free.total());
        assertEquals(new BigDecimal("0.00"),free.deposit());
    }

    @Test void removedPremiumItemReducesPerGuestPrice() {
        var hall = new VenueHallSnapshot(1, 1, 1, 50, 500, new BigDecimal("70"), BigDecimal.ONE);
        var price = new BookingPriceCalculator().calculate(hall, 100, List.of(), BigDecimal.ZERO, new BigDecimal("-800"));
        assertEquals(new BigDecimal("7000.00"), price.hall());
        assertEquals(new BigDecimal("0.00"), price.services());
        assertEquals(new BigDecimal("6200.00"), price.total());
    }
}
