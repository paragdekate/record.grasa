import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { InAppAlert } from './db';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export async function scheduleNotificationForAlert(alert: InAppAlert) {
  if (Platform.OS === 'web') return;
  if (!alert.isActive) return;

  const [hoursStr, minutesStr] = alert.time.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  // Cancel any existing notification for this alert ID first to avoid duplicates
  await cancelNotificationForAlert(alert.id);

  try {
    const trigger = {
      type: 'calendar',
      hour: hours,
      minute: minutes,
      repeats: true,
    } as any;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: alert.type === 'meal' ? 'Meal Sugar Check 🍽️' : 'Record Blood Glucose 🩸',
        body: alert.label || `Time to record your blood sugar level!`,
        sound: true,
        data: { alertId: alert.id, type: alert.type },
      },
      trigger,
    });
    
    return notificationId;
  } catch (error) {
    console.error('Failed to schedule notification for alert:', alert.id, error);
  }
}

export async function cancelNotificationForAlert(alertId: string) {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter(
      (n) => n.content.data && n.content.data.alertId === alertId
    );
    for (const notif of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  } catch (error) {
    console.error('Failed to cancel notifications for alert:', alertId, error);
  }
}

export async function syncAllScheduledNotifications(alerts: InAppAlert[]) {
  if (Platform.OS === 'web') return;
  
  try {
    // Clear all scheduled notifications first to have a clean state
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Reschedule all active ones
    for (const alert of alerts) {
      if (alert.isActive) {
        await scheduleNotificationForAlert(alert);
      }
    }
  } catch (e) {
    console.error('Failed to sync scheduled notifications:', e);
  }
}
