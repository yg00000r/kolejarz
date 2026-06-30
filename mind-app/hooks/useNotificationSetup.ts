import { useCallback, useEffect, useState } from 'react';
import {
  cancelByType,
  configureNotifications,
  DEFAULT_NOTIF_PREFS,
  getNotifPrefs,
  type NotifPrefs,
  requestNotificationPermissions,
  saveNotifPrefs,
  scheduleShiftAlarm,
} from '../services/notifications';
import { fetchShifts, scheduleTimecardReminder, type Shift } from '../services/work';

const TIMECARD_PENDING = ['do_potwierdzenia', 'wydana'];

export type { NotifPrefs };

/** Pobiera służby z bieżącego i następnego miesiąca (do zaplanowania powiadomień). */
async function upcomingShifts(): Promise<Shift[]> {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const [a, b] = await Promise.all([
    fetchShifts(m, y).catch(() => [] as Shift[]),
    fetchShifts(nextM, nextY).catch(() => [] as Shift[]),
  ]);
  return [...a, ...b];
}

/** (Re)schedules all local notifications according to prefs + upcoming shifts. */
export async function rescheduleNotifications(p: NotifPrefs): Promise<void> {
  await cancelByType('shift');
  await cancelByType('timecard');
  if (!p.shiftAlarm && !p.timecardReminder) return;

  const shifts = await upcomingShifts();
  for (const s of shifts) {
    if (s.typ !== 'praca') continue;
    if (p.shiftAlarm) {
      await scheduleShiftAlarm(s, p.shiftAlarmMinutes);
    }
    if (p.timecardReminder && s.statusKarty && TIMECARD_PENDING.includes(s.statusKarty)) {
      await scheduleTimecardReminder(s);
    }
  }
}

/**
 * Manages local-notification preferences (persisted in AsyncStorage) and keeps
 * the scheduled notifications in sync with upcoming shifts. All notifications
 * are local — works on a free Apple Personal Team.
 */
export function useNotificationSetup() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void configureNotifications();
    getNotifPrefs().then((p) => {
      setPrefs(p);
      setLoaded(true);
    });
  }, []);

  const persist = useCallback(async (next: NotifPrefs) => {
    setPrefs(next);
    await saveNotifPrefs(next);
    await rescheduleNotifications(next);
  }, []);

  /** Returns false if the user denied notification permission. */
  const toggleShiftAlarm = useCallback(async (value: boolean): Promise<boolean> => {
    if (value && !(await requestNotificationPermissions())) return false;
    await persist({ ...prefs, shiftAlarm: value });
    return true;
  }, [prefs, persist]);

  const toggleTimecardReminder = useCallback(async (value: boolean): Promise<boolean> => {
    if (value && !(await requestNotificationPermissions())) return false;
    await persist({ ...prefs, timecardReminder: value });
    return true;
  }, [prefs, persist]);

  const setShiftAlarmMinutes = useCallback(async (minutes: number) => {
    await persist({ ...prefs, shiftAlarmMinutes: minutes });
  }, [prefs, persist]);

  return {
    prefs,
    loaded,
    toggleShiftAlarm,
    toggleTimecardReminder,
    setShiftAlarmMinutes,
    /** Re-schedule using current prefs (e.g. after a portal sync). */
    refresh: useCallback(() => rescheduleNotifications(prefs), [prefs]),
  };
}
