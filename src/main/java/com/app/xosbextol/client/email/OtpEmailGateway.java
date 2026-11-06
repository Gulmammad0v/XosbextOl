package com.app.xosbextol.client.email;

public interface OtpEmailGateway {
    void sendCode(String email, String code, long ttlSeconds);
}
