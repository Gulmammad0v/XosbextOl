import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants, { AppOwnership } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { router } from 'expo-router';
import { api } from './api';
import { useAuth } from './auth';
import { translate } from './i18n';

const CHANNEL_ID = 'bookings';
const RUNNING_IN_EXPO_GO = Constants.appOwnership === AppOwnership.Expo;
type FirebaseMessagingModule = typeof import('@react-native-firebase/messaging');
type FirebaseMessaging = ReturnType<FirebaseMessagingModule['getMessaging']>;

if (!RUNNING_IN_EXPO_GO) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

type NotificationState = {
  unreadCount: number;
  pushEnabled: boolean;
  permissionStatus: 'unknown' | 'granted' | 'denied' | 'unavailable';
  canAskPermission: boolean;
  refreshUnread(): Promise<void>;
  refreshPushPermission(): Promise<boolean>;
  enablePushNotifications(): Promise<boolean>;
};

const NotificationContext = createContext<NotificationState | null>(null);

function allowed(status: Notifications.NotificationPermissionsStatus) {
  if (Platform.OS !== 'ios') return status.granted;
  return status.ios?.status === IosAuthorizationStatus.AUTHORIZED
    || status.ios?.status === IosAuthorizationStatus.PROVISIONAL
    || status.ios?.status === IosAuthorizationStatus.EPHEMERAL;
}

function safeDeepLink(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return undefined;
  return value;
}

function messageData(message: { data?: Record<string, string | object> }) {
  return message.data || {};
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationState['permissionStatus']>('unknown');
  const [canAskPermission, setCanAskPermission] = useState(true);
  const [firebaseModule, setFirebaseModule] = useState<FirebaseMessagingModule | null>(null);
  const pendingDeepLink = useRef<string | undefined>(undefined);
  const messaging = useMemo<FirebaseMessaging | null>(
    () => firebaseModule?.getMessaging() ?? null,
    [firebaseModule],
  );

  useEffect(() => {
    if (RUNNING_IN_EXPO_GO) return;
    let active = true;
    void import('@react-native-firebase/messaging')
      .then(module => { if (active) setFirebaseModule(module); })
      .catch(() => { if (active) setPushEnabled(false); });
    return () => { active = false; };
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      await Notifications.setBadgeCountAsync(0).catch(() => undefined);
      return;
    }
    try {
      const result = await api.unreadNotificationCount();
      const count = result.count || 0;
      setUnreadCount(count);
      await Notifications.setBadgeCountAsync(count).catch(() => undefined);
    } catch {}
  }, [user]);

  const openMessage = useCallback(async (data: Record<string, string | object | undefined>) => {
    const notificationId = Number(data.notificationId);
    if (user && Number.isFinite(notificationId)) {
      await api.readNotification(notificationId).catch(() => undefined);
      await refreshUnread();
    }
    const deepLink = safeDeepLink(data.deepLink);
    if (!deepLink) return;
    if (!user) {
      pendingDeepLink.current = deepLink;
      return;
    }
    router.push(deepLink as never);
  }, [refreshUnread, user]);

  const ensureChannel = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: translate('notificationChannel.name'),
      description: translate('notificationChannel.description'),
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }, []);

  const refreshPushPermission = useCallback(async () => {
    if (!Device.isDevice) {
      setPushEnabled(false);
      setPermissionStatus('unavailable');
      setCanAskPermission(false);
      return false;
    }
    try {
      const current = await Notifications.getPermissionsAsync();
      const enabled = allowed(current);
      setPushEnabled(enabled);
      setPermissionStatus(enabled ? 'granted' : 'denied');
      setCanAskPermission(current.canAskAgain);
      return enabled;
    } catch {
      setPushEnabled(false);
      setPermissionStatus('unavailable');
      setCanAskPermission(false);
      return false;
    }
  }, []);

  const syncPermission = useCallback(async () => {
    if (RUNNING_IN_EXPO_GO || !Device.isDevice || !firebaseModule || !messaging) {
      return refreshPushPermission();
    }
    await ensureChannel();
    const enabled = await refreshPushPermission();
    if (enabled && user) await firebaseModule.register(messaging);
    return enabled;
  }, [ensureChannel, firebaseModule, messaging, refreshPushPermission, user]);

  const enablePushNotifications = useCallback(async () => {
    if (!Device.isDevice) return false;
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    const status = allowed(current) ? current : await Notifications.requestPermissionsAsync();
    const enabled = allowed(status);
    setPushEnabled(enabled);
    setPermissionStatus(enabled ? 'granted' : 'denied');
    setCanAskPermission(status.canAskAgain);
    if (enabled && user && firebaseModule && messaging) await firebaseModule.register(messaging);
    return enabled;
  }, [ensureChannel, firebaseModule, messaging, user]);

  useEffect(() => {
    void refreshPushPermission();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshPushPermission();
    });
    return () => subscription.remove();
  }, [refreshPushPermission]);

  useEffect(() => {
    void refreshUnread();
    if (!user) return;
    const timer = setInterval(() => void refreshUnread(), 30_000);
    return () => clearInterval(timer);
  }, [refreshUnread, user]);

  useEffect(() => {
    if (!user || !pendingDeepLink.current) return;
    const deepLink = pendingDeepLink.current;
    pendingDeepLink.current = undefined;
    router.push(deepLink as never);
  }, [user]);

  useEffect(() => {
    if (!user || !firebaseModule || !messaging) return;
    const unsubscribeRegistered = firebaseModule.onRegistered(messaging, installationId => {
      void api.registerDevice(installationId, Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
    });
    void syncPermission();
    return unsubscribeRegistered;
  }, [firebaseModule, messaging, syncPermission, user]);

  useEffect(() => {
    if (!firebaseModule || !messaging) return;
    const unsubscribeMessage = firebaseModule.onMessage(messaging, async message => {
      await ensureChannel();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.notification?.title || translate('notificationChannel.newNotification'),
          body: message.notification?.body || '',
          data: messageData(message),
          ...(Platform.OS === 'ios' ? { sound: 'default' as const } : {}),
        },
        trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
      });
      await refreshUnread();
    });
    const unsubscribeOpened = firebaseModule.onNotificationOpenedApp(messaging, message => {
      void openMessage(messageData(message));
    });
    const localResponse = Notifications.addNotificationResponseReceivedListener(response => {
      void openMessage(response.notification.request.content.data as Record<string, string | object | undefined>);
    });
    void firebaseModule.getInitialNotification(messaging).then(message => {
      if (message) return openMessage(messageData(message));
    });
    return () => {
      unsubscribeMessage();
      unsubscribeOpened();
      localResponse.remove();
    };
  }, [ensureChannel, firebaseModule, messaging, openMessage, refreshUnread]);

  const value = useMemo(() => ({ unreadCount, pushEnabled, permissionStatus, canAskPermission, refreshUnread, refreshPushPermission, enablePushNotifications }),
    [canAskPermission, enablePushNotifications, permissionStatus, pushEnabled, refreshPushPermission, refreshUnread, unreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationState() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotificationState must be used inside NotificationProvider');
  return value;
}
