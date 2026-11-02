import { currentLang, tr, type TKey } from './i18n';

/** Relative time, tuned for a list where recency matters. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return tr('time.justNow');
  if (min < 60) return tr('time.min', { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return tr('time.hour', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return tr('time.yesterday');
  if (days < 30) return tr('time.day', { n: days });
  const months = Math.floor(days / 30);
  if (months < 12) return tr('time.month', { n: months });
  return tr('time.year', { n: Math.floor(months / 12) });
}

export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

const weekday = (d: Date) => tr(`weekday.${d.getDay()}` as TKey);

/** "Thứ Ba, 27 tháng 10" — the date line at the top of the mobile screens. */
export function longDate(d = new Date()): string {
  return tr('date.long', { weekday: weekday(d), day: d.getDate(), month: tr(`month.${d.getMonth()}` as TKey) });
}

export function shortDate(d = new Date()): string {
  return tr('date.short', {
    weekday: weekday(d),
    day: String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
  });
}

/** "09:00" */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Hôm nay · 16:00", "Thứ Năm", "31/10" — the reminder chip wording. */
export function reminderLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(new Date(now))) / 86_400_000);
  if (dayDiff < 0) return tr('time.yesterday');
  if (dayDiff === 0) return clockTime(iso);
  if (dayDiff === 1) return tr('time.tomorrow', { time: clockTime(iso) });
  if (dayDiff < 7) return weekday(d);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** "1.284" in Vietnamese, "1,284" in English. */
export function count(n: number): string {
  return n.toLocaleString(currentLang() === 'en' ? 'en-US' : 'vi-VN');
}

/** Masks a secret to a fixed-width dot run, keeping any visible prefix. */
export function mask(secret: string, prefix = 0): string {
  if (!secret) return '';
  const keep = prefix > 0 ? secret.slice(0, prefix) : '';
  return keep + '•'.repeat(Math.max(8, Math.min(24, secret.length)));
}

/** Splits a secret into coloured runs so digits and symbols stand out. */
export function colorize(secret: string): { text: string; tone: 'plain' | 'digit' | 'symbol' }[] {
  const runs: { text: string; tone: 'plain' | 'digit' | 'symbol' }[] = [];
  for (const ch of secret) {
    const tone = /[0-9]/.test(ch) ? 'digit' : /[^A-Za-z0-9]/.test(ch) ? 'symbol' : 'plain';
    const last = runs[runs.length - 1];
    if (last && last.tone === tone) last.text += ch;
    else runs.push({ text: ch, tone });
  }
  return runs;
}

/** A stable initial for the credential avatar tiles. */
export function initial(title: string): string {
  const t = title.trim();
  if (!t) return '?';
  if (/^[\d\s]/.test(t)) return '#';
  return t[0].toUpperCase();
}
