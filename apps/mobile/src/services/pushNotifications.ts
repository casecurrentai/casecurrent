import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let pushToken: string | null = null;

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] Permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    
    pushToken = tokenData.data;
    console.log('[Push] Token:', pushToken?.substring(0, 20) + '...');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('incoming-calls', {
        name: 'Incoming Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1764FE',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    return pushToken;
  } catch (error) {
    console.error('[Push] Registration error:', error);
    return null;
  }
}

export async function registerDeviceWithServer(deviceId: string): Promise<void> {
  const token = pushToken || await registerForPushNotifications();
  
  if (!token) {
    console.log('[Push] No token available, skipping server registration');
    return;
  }

  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await api.devices.register(platform, token, deviceId, {
      hotLeads: true,
      inboundSms: true,
      slaBreaches: true,
      privacyMode: false,
    });
    console.log('[Push] Device registered with server');
  } catch (error) {
    console.error('[Push] Server registration failed:', error);
  }
}

export function getPushToken(): string | null {
  return pushToken;
}

export interface NotificationData {
  type?: string;
  leadId?: string;
  callSid?: string;
}

export function addNotificationResponseListener(
  callback: (data: NotificationData) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as NotificationData;
    console.log('[Push] Notification tapped:', data);
    callback(data);
  });
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}
