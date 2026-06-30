import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Shift } from './work';

/**
 * Local notifications service — works on a free Apple Personal Team
 * (no `aps-environment`, no paid Apple Developer). Everything here is scheduled
 * on-device via `expo-notifications`; nothing requires a push certificate.
 *
 * All notifications are surfaced under the label "Asystent".
 */

const ASYSTENT = 'Asystent';
export const ANDROID_CHANNEL_ID = 'asystent';

/** Tag prefixes so we can selectively cancel by category. */
type NotifType = 'shift' | 'timecard';

let _handlerConfigured = false;

/**
 * Sets the foreground presentation handler + Android channel.
 * Idempotent — safe to call on every app launch.
 */
export async function configureNotifications(): Promise<void> {
  if (!_handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    _handlerConfigured = true;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: ASYSTENT,
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Builds a Date from `YYYY-MM-DD` + `HH:MM`, or null if malformed. */
function combineDateTime(dateIso: string, hhmm: string): Date | null {
  const dm = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [, y, mo, d] = dm.map(Number) as unknown as [string, number, number, number];
  const [, h, mi] = tm.map(Number) as unknown as [string, number, number];
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

async function scheduleAt(
  triggerDate: Date,
  body: string,
  type: NotifType,
  data: Record<string, unknown> = {},
): Promise<string | null> {
  const now = new Date();
  if (triggerDate <= now) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: ASYSTENT,
      body,
      sound: 'default',
      data: { type, ...data },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

/**
 * Schedules an alarm `minutesBefore` the start of a work shift.
 * Returns the scheduled notification id, or null if the shift has no start
 * time / is in the past.
 */
export async function scheduleShiftAlarm(shift: Shift, minutesBefore = 60): Promise<string | null> {
  if (shift.typ !== 'praca' || !shift.start) return null;
  const start = combineDateTime(shift.date, shift.start);
  if (!start) return null;
  const trigger = new Date(start.getTime() - minutesBefore * 60_000);
  const label = shift.sluzba ? `Służba ${shift.sluzba}` : 'Służba';
  return scheduleAt(
    trigger,
    `${label} startuje o ${shift.start}${minutesBefore ? ` (za ${minutesBefore} min)` : ''}.`,
    'shift',
    { date: shift.date },
  );
}

/** Cancels all notifications of a given category (shift / timecard). */
export async function cancelByType(type: NotifType): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as Record<string, unknown> | undefined)?.type === type)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function cancelAllAssistantNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Preferences (persisted) ───────────────────────────────────────────────

const PREFS_KEY = 'mind_notif_prefs';

export type NotifPrefs = {
  /** Alarm przed startem służby. */
  shiftAlarm: boolean;
  /** Ile minut przed startem służby. */
  shiftAlarmMinutes: number;
  /** Przypomnienie o potwierdzeniu karty pracy (po zakończeniu służby). */
  timecardReminder: boolean;
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  shiftAlarm: false,
  shiftAlarmMinutes: 60,
  timecardReminder: true,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {
    // fall through to defaults
  }
  return DEFAULT_NOTIF_PREFS;
}

export async function saveNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
