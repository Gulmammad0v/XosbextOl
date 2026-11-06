package com.app.xosbextol.service.impl;

import com.app.xosbextol.model.enums.DeviceStatus;
import com.app.xosbextol.model.entity.Notification;
import com.app.xosbextol.repository.NotificationRepository;
import com.app.xosbextol.repository.UserDeviceRepository;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ChannelDelivery {
    public enum Result { SENT, SKIPPED }

    private final ObjectProvider<FirebaseMessaging> firebaseProvider;
    private final UserDeviceRepository devices;
    private final NotificationRepository notifications;
    private final NotificationPreferenceService preferences;

    public Result send(Notification notification) {
        if (!preferences.allows(notification.getUser().getId(), notification.getType())) return Result.SKIPPED;
        FirebaseMessaging firebase = firebaseProvider.getIfAvailable();
        var activeDevices = devices.findByUser_IdAndStatusAndFcmTokenIsNotNull(
                notification.getUser().getId(), DeviceStatus.ACTIVE);
        if (firebase == null || activeDevices.isEmpty()) return Result.SKIPPED;

        int sent = 0;
        int badge = (int) Math.min(Integer.MAX_VALUE,
                notifications.countUnread(notification.getUser().getId()));
        for (var device : activeDevices) {
            try {
                firebase.send(message(notification, device.getFcmToken(), badge));
                sent++;
            } catch (FirebaseMessagingException exception) {
                if (exception.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
                    device.setFcmToken(null);
                    continue;
                }
                throw new PushDeliveryException(exception);
            }
        }
        return sent > 0 ? Result.SENT : Result.SKIPPED;
    }

    private Message message(Notification notification, String installationId, int badge) {
        var builder = Message.builder()
                .setFid(installationId)
                .setNotification(com.google.firebase.messaging.Notification.builder()
                        .setTitle(notification.getTitle())
                        .setBody(notification.getBody())
                        .build())
                .putData("type", notification.getType())
                .putData("notificationId", String.valueOf(notification.getId()))
                .setAndroidConfig(AndroidConfig.builder()
                        .setNotification(AndroidNotification.builder()
                                .setChannelId("bookings")
                                .setSound("default")
                                .build())
                        .build())
                .setApnsConfig(ApnsConfig.builder()
                        .setAps(Aps.builder().setBadge(badge).setSound("default").build())
                        .build());
        if (notification.getDeepLink() != null) {
            builder.putData("deepLink", notification.getDeepLink());
        }
        return builder.build();
    }

    public static final class PushDeliveryException extends RuntimeException {
        public PushDeliveryException(Throwable cause) {
            super(cause);
        }
    }
}
