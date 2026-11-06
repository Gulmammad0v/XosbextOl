package com.app.xosbextol.model.value;

import lombok.Value;
import lombok.experimental.Accessors;

import java.math.BigDecimal;

@Value
@Accessors(fluent = true)
public class BookingPrice {
    BigDecimal hall;
    BigDecimal services;
    BigDecimal discount;
    BigDecimal total;
    BigDecimal deposit;
}
