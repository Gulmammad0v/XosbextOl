package com.app.xosbextol.handler.customExceptions;

import com.app.xosbextol.model.dto.UserDeviceResponseDto;
import org.springframework.http.HttpStatus;

import java.util.List;

public class DeviceLimitException extends BusinessException {
    private final String limitToken;
    private final int deviceLimit;
    private final List<UserDeviceResponseDto> devices;

    public DeviceLimitException(String limitToken, int deviceLimit, List<UserDeviceResponseDto> devices) {
        super(HttpStatus.CONFLICT, "AUTH_DEVICE_LIMIT_REACHED");
        this.limitToken = limitToken;
        this.deviceLimit = deviceLimit;
        this.devices = devices;
    }

    public String limitToken() {
        return limitToken;
    }

    public int deviceLimit() {
        return deviceLimit;
    }

    public List<UserDeviceResponseDto> devices() {
        return devices;
    }
}
