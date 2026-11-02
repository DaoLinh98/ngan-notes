/**
 * Vault encryption.
 *
 * The master password never leaves the browser and is never stored. It is run
 * through PBKDF2-SHA256 to derive an AES-GCM key; that key encrypts the whole
 * payload. A separate small "verifier" blob is encrypted with the same key so
 * we can tell a wrong password from a corrupt file without decrypting
 * everything.
 */

import { tr, type TKey } from './i18n';

const PBKDF2_ITERATIONS = 250_000;
const VERIFIER_PLAINTEXT = 'ngan-vault-v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(key: CryptoKey, plaintext: string, iv: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plaintext),
  );
  return toBase64(new Uint8Array(buf));
}

async function decrypt(key: CryptoKey, ciphertext: string, iv: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    fromBase64(ciphertext) as BufferSource,
  );
  return dec.decode(buf);
}

export interface Sealed {
  salt: string;
  iv: string;
  verifier: string;
  dataIv: string;
  data: string;
}

/** Encrypt a payload under a fresh salt+IVs. Returns the sealed envelope. */
export async function seal(password: string, payload: unknown): Promise<Sealed> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  const iv = randomBytes(12);
  const dataIv = randomBytes(12);
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    verifier: await encrypt(key, VERIFIER_PLAINTEXT, iv),
    dataIv: toBase64(dataIv),
    data: await encrypt(key, JSON.stringify(payload), dataIv),
  };
}

/** Re-encrypt an existing payload, keeping the salt so the password is unchanged. */
export async function reseal(password: string, sealed: Sealed, payload: unknown): Promise<Sealed> {
  const salt = fromBase64(sealed.salt);
  const key = await deriveKey(password, salt);
  const dataIv = randomBytes(12);
  return {
    salt: sealed.salt,
    iv: sealed.iv,
    verifier: sealed.verifier,
    dataIv: toBase64(dataIv),
    data: await encrypt(key, JSON.stringify(payload), dataIv),
  };
}

/** Throws if the password is wrong or the file is corrupt. */
export async function unseal<T>(password: string, sealed: Sealed): Promise<T> {
  const key = await deriveKey(password, fromBase64(sealed.salt));
  const proof = await decrypt(key, sealed.verifier, fromBase64(sealed.iv));
  if (proof !== VERIFIER_PLAINTEXT) throw new Error(tr('err.wrongPassword'));
  return JSON.parse(await decrypt(key, sealed.data, fromBase64(sealed.dataIv))) as T;
}

/** Cheap strength estimate: 0–4, matching the four-segment meter in the design. */
export function strength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: tr('strength.empty') };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(4, score);
  const label = tr(`strength.${score}` as TKey);
  return { score, label };
}

const WORDS = [
  'xanh', 'mua', 'nang', 'gio', 'bien', 'nui', 'sao', 'may', 'hoa', 'suong',
  'tra', 'cafe', 'sach', 'den', 'trang', 'vang', 'bac', 'tim', 'hong', 'cam',
];

/** Human-readable password, in the spirit of the design's `Tr4ng#Xanh27!mua`. */
export function generatePassword(length = 18): string {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  const symbols = '!@#$%&*?';
  let out = '';
  while (out.length < length) {
    const chunk = Math.random() < 0.5 ? cap(pick()) : pick();
    out += chunk + (Math.random() < 0.4 ? symbols[Math.floor(Math.random() * symbols.length)] : '');
    if (out.length < length && Math.random() < 0.5) out += Math.floor(Math.random() * 90 + 10);
  }
  return out.slice(0, length);
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes an RFC 4648 base32 seed — the form every authenticator app hands
 * out (`JBSWY3DPEHPK3PXP`). Spaces, padding and case are ignored.
 */
export function fromBase32(seed: string): Uint8Array {
  const clean = seed.toUpperCase().replace(/[\s=]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** RFC 6238 TOTP, so the 2FA row in the design shows a real rotating code. */
export async function totp(seed: string, at = Date.now()): Promise<string> {
  const counter = Math.floor(at / 30_000);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const key = await crypto.subtle.importKey(
    'raw',
    fromBase32(seed) as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    (((mac[offset] & 0x7f) << 24) |
      (mac[offset + 1] << 16) |
      (mac[offset + 2] << 8) |
      mac[offset + 3]) %
    1_000_000;
  return String(code).padStart(6, '0');
}

/** Seconds until the current TOTP window rolls over. */
export const totpRemaining = (at = Date.now()): number => 30 - Math.floor((at % 30_000) / 1000);
