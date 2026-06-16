/**
 * Szyfrowanie AES-256-GCM dla haseł portalu IVU przechowywanych w bazie danych.
 *
 * Klucz pochodzi z ENCRYPTION_KEY w .env (32 bajty = 64 znaki hex).
 * Generowanie: openssl rand -hex 32
 *
 * W środowisku deweloperskim (brak klucza) działa w trybie passthrough —
 * tekst jest przechowywany bez szyfrowania. NIE używaj tego w produkcji.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY ?? '';
  if (hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

export function encrypt(text: string): string {
  const key = getKey();
  if (!key) return text; // dev fallback — plaintext (brak klucza)

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(stored: string): string {
  const key = getKey();
  if (!key) return stored; // dev fallback

  const parts = stored.split(':');
  if (parts.length !== 3) return stored; // plaintext lub nieprawidłowy format

  const [ivHex, tagHex, encHex] = parts;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString('utf8') + decipher.final('utf8');
  } catch {
    return stored;
  }
}
