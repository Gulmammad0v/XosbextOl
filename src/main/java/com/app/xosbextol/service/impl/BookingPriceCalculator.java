package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.value.BookingPrice;
import com.app.xosbextol.model.value.VenueHallSnapshot;

import com.app.xosbextol.model.value.VenueExtraSnapshot;

import org.springframework.stereotype.Component;

import java.math.*;
import java.util.List;

@Component
public class BookingPriceCalculator {
    public BookingPrice calculate(VenueHallSnapshot hall, int guests, List<VenueExtraSnapshot> extras, BigDecimal discount) {
        return calculate(hall, guests, extras, discount, BigDecimal.ZERO);
    }

    public BookingPrice calculate(VenueHallSnapshot hall, int guests,
                                  List<VenueExtraSnapshot> extras,
                                  BigDecimal discount, BigDecimal menuAdjustment) {
        BigDecimal hallPrice = money(hall.perPerson().multiply(BigDecimal.valueOf(guests)));
        BigDecimal services = money(extras.stream().map(e -> e.price().multiply(BigDecimal.valueOf(e.perPerson() ? guests : 1))).reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal gross = hallPrice.add(services).add(money(menuAdjustment));
        BigDecimal applied = money(discount.max(BigDecimal.ZERO).min(gross));
        BigDecimal total = gross.subtract(applied);
        BigDecimal deposit = money(BigDecimal.valueOf(guests)).min(total);
        return new BookingPrice(hallPrice, services, applied, total, deposit);
    }

    public BigDecimal percentage(BigDecimal amount, BigDecimal percent) {
        return money(amount.multiply(percent).divide(new BigDecimal("100")));
    }

    public BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
