import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_RUN_SESSION,
  EMPTY_SESSION,
  TrainRunSession,
  TrainSession,
  runSessionToTrainSession,
} from '../constants/komunikaty';

const KEY_V1 = 'train_session_v1';
const KEY_V2 = 'train_run_session_v2';

// ─── Legacy TrainSession (v1) — used by classic compose ──────────────────────

export async function loadTrainSession(): Promise<TrainSession | null> {
  try {
    const run = await loadRunSession();
    if (run) return runSessionToTrainSession(run);

    const raw = await AsyncStorage.getItem(KEY_V1);
    if (!raw) return null;
    return JSON.parse(raw) as TrainSession;
  } catch {
    return null;
  }
}

export async function saveTrainSession(session: TrainSession): Promise<void> {
  await AsyncStorage.setItem(KEY_V1, JSON.stringify(session));
}

export async function clearTrainSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY_V1);
}

export function isSessionValid(s: TrainSession | null): boolean {
  if (!s) return false;
  return !!(s.trainNumber && s.stationStart && s.stationEnd && s.serviceWagon);
}

// ─── TrainRunSession (v2) — used by Pilnowanie ──────────────────────────────

export async function loadRunSession(): Promise<TrainRunSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_V2);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 2) return null;
    return parsed as TrainRunSession;
  } catch {
    return null;
  }
}

export async function saveRunSession(session: TrainRunSession): Promise<void> {
  await AsyncStorage.setItem(KEY_V2, JSON.stringify(session));
}

export async function clearRunSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY_V2);
}

export function isRunSessionValid(s: TrainRunSession | null): boolean {
  if (!s) return false;
  return !!(
    s.trainNumber &&
    s.stops.length >= 2 &&
    s.serviceWagon &&
    s.workEndIndex > s.workStartIndex
  );
}

export { EMPTY_SESSION, EMPTY_RUN_SESSION };
