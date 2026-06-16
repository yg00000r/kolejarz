import * as Notifications from 'expo-notifications';
import { TrainRunSession, TrainStop, workStops } from '../constants/komunikaty';

const OFFSET_MINUTES = 5;

type ScheduledIds = Record<string, string>; // stopIndex → notificationId

let _scheduledIds: ScheduledIds = {};

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function parseTimeToday(hhmm: string, dateStr: string, offsetMinutes: number): Date | null {
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, hStr, mStr] = match;
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day, h, m, 0, 0);
  d.setMinutes(d.getMinutes() - OFFSET_MINUTES + offsetMinutes);
  return d;
}

export async function scheduleStationNotifications(
  run: TrainRunSession,
): Promise<number> {
  await cancelAllStationNotifications();

  const stops = workStops(run);
  const now = new Date();
  let count = 0;

  for (let i = 1; i < stops.length; i++) {
    const stop = stops[i];
    const timeRef = stop.arrivalPlanned ?? stop.departurePlanned;
    if (!timeRef) continue;

    const triggerDate = parseTimeToday(timeRef, run.date, -OFFSET_MINUTES + run.delayMinutes);
    if (!triggerDate || triggerDate <= now) continue;

    const secondsUntil = Math.floor((triggerDate.getTime() - now.getTime()) / 1000);
    if (secondsUntil <= 0) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Za ~5 min: ${stop.name}`,
        body: `${run.category} ${run.trainNumber} — przygotuj komunikat pożegnalny`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
      },
    });

    _scheduledIds[`${i}`] = id;
    count++;
  }

  return count;
}

export async function cancelAllStationNotifications(): Promise<void> {
  const ids = Object.values(_scheduledIds);
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // already fired or cancelled
    }
  }
  _scheduledIds = {};
}

export async function rescheduleForDelay(
  run: TrainRunSession,
): Promise<number> {
  return scheduleStationNotifications(run);
}

export function getScheduledCount(): number {
  return Object.keys(_scheduledIds).length;
}
