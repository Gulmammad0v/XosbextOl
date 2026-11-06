package com.app.xosbextol.service;
public interface PaymentAccess {
    // Returns true only when every unfinished payment is definitively stopped or failed.
    boolean resolveBeforeExpiry(long bookingId);
}
