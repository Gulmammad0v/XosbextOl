package com.app.xosbextol.model.value;
import lombok.Value;
import lombok.experimental.Accessors;
import java.math.BigDecimal;
@Value @Accessors(fluent=true)
public class VenueHallSnapshot {
    long id; long venueId; long ownerId; int minGuests; int maxGuests; BigDecimal perPerson;
    BigDecimal depositPercent;
}
