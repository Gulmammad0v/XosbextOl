package com.app.xosbextol.model.value;

import lombok.Value;
import lombok.experimental.Accessors;

import java.math.BigDecimal;

@Value
@Accessors(fluent = true)
public class VenueExtraSnapshot {
    long id;
    String name;
    BigDecimal price;
    boolean perPerson;
}
