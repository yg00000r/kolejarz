// Kolejarz backend API
// Nadpisz lokalnie przez EXPO_PUBLIC_API_URL w mind-app/.env (patrz .env.example).
const DEFAULT_PRODUCTION_URL = 'http://57.128.246.232:3000';

export const BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL?.trim()) ||
  DEFAULT_PRODUCTION_URL;
