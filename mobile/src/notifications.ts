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
    // 1. Schedule the main reminder
    const trigger = {
      type: 'calendar',
      hour: hours,
      minute: minutes,
      repeats: true,
    } as any;

    const isRecordAlert = alert.type === 'record';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: isRecordAlert ? 'Record Blood Glucose 🩸' : 'Meal Sugar Check 🍽️',
        body: alert.label || `Time to record your blood sugar level!`,
        sound: isRecordAlert ? 'alarm.wav' : true,
        priority: isRecordAlert ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.DEFAULT,
        // Loud/long vibrate pattern for log-reminders
        vibrate: isRecordAlert ? [0, 500, 250, 500, 250, 500, 250, 500] : undefined,
        data: { alertId: alert.id, type: alert.type, isFollowUp: false },
      },
      trigger,
    });

    // 2. For log-reminders, schedule 3 consecutive follow-up re-alerts at +30m, +60m, and +90m
    if (isRecordAlert) {
      const intervals = [30, 60, 90];
      for (const offset of intervals) {
        let followUpMins = minutes + offset;
        let followUpHours = hours + Math.floor(followUpMins / 60);
        followUpMins = followUpMins % 60;
        followUpHours = followUpHours % 24;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Urgent: Log Blood Sugar ⚠️',
            body: `Still haven't recorded your sugar level! Please click here and log now.`,
            sound: 'alarm.wav',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 500, 250, 500, 250, 500, 250, 500],
            data: { alertId: alert.id, type: alert.type, isFollowUp: true },
          },
          trigger: {
            type: 'calendar',
            hour: followUpHours,
            minute: followUpMins,
            repeats: true,
          } as any,
        });
      }
    }
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

export async function cancelPendingFollowUps() {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter(
      (n) => n.content.data && n.content.data.isFollowUp === true
    );
    for (const notif of toCancel) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
    console.log(`Cancelled ${toCancel.length} active follow-up alarms.`);
  } catch (error) {
    console.error('Failed to cancel follow-up notifications:', error);
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
