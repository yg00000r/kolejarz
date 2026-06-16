/**
 * Wspólny helper do wywołań API backendu.
 *
 * Automatycznie dołącza nagłówek Authorization: Bearer z tokenu sesji
 * przechowywanego w SecureStore. Wszystkie serwisy (work.ts, monitoring.ts)
 * powinny używać tej funkcji zamiast bezpośrednio fetch().
 */

import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '../constants/api';

export const SESSION_TOKEN_KEY = 'kolejarz_session_token';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);

  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}
