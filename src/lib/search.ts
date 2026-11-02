import type { Folder, Item, Kind } from './types';
import { KIND, KIND_ORDER } from './kind';

/**
 * Query syntax, as advertised in the palette footer:
 *   loại:khoá  #devops  ngăn:Công việc  — plus free text.
 * Everything is matched case- and accent-insensitively.
 */

export interface ParsedQuery {
  text: string;
  kinds: Kind[];
  labels: string[];
  folders: string[];
  starred: boolean;
  pinned: boolean;
}

/** Strips Vietnamese diacritics so "khoa" finds "khoá". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const KIND_ALIASES: Record<string, Kind> = {
  'ghi chu': 'note',
  note: 'note',
  'dang nhap': 'login',
  login: 'login',
  'khoa': 'secret',
  'khoa bi mat': 'secret',
  secret: 'secret',
  key: 'secret',
  'ca nhan': 'person',
  person: 'person',
  viec: 'task',
  task: 'task',
  todo: 'task',
  'lien ket': 'link',
  link: 'link',
};

function kindFromWord(word: string): Kind | null {
  const f = fold(word.trim());
  if (KIND_ALIASES[f]) return KIND_ALIASES[f];
  const hit = KIND_ORDER.find((k) => fold(KIND[k].label) === f);
  return hit ?? null;
}

export function parseQuery(raw: string): ParsedQuery {
  const q: ParsedQuery = {
    text: '',
    kinds: [],
    labels: [],
    folders: [],
    starred: false,
    pinned: false,
  };
  const words: string[] = [];

  // Split on whitespace but keep quoted spans together, so `ngăn:"Công việc"`
  // and multi-word folder names survive.
  const tokens = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];

  for (const token of tokens) {
    const [head, ...rest] = token.split(':');
    const value = rest.join(':').replace(/^"|"$/g, '');
    const key = fold(head);

    if (rest.length && (key === 'loai' || key === 'type')) {
      const k = kindFromWord(value);
      if (k) q.kinds.push(k);
      continue;
    }
    if (rest.length && (key === 'ngan' || key === 'folder')) {
      if (value) q.folders.push(fold(value));
      continue;
    }
    if (token.startsWith('#')) {
      const label = fold(token.slice(1));
      if (label) q.labels.push(label);
      continue;
    }
    if (token.startsWith('@')) {
      const flag = fold(token.slice(1));
      if (flag === 'quan trong' || flag === 'star' || flag === 'starred') q.starred = true;
      if (flag === 'ghim' || flag === 'pin' || flag === 'pinned') q.pinned = true;
      continue;
    }
    words.push(token);
  }

  q.text = words.join(' ').trim();
  return q;
}

/** True when the query constrains nothing — used to skip filtering entirely. */
export function isEmptyQuery(q: ParsedQuery): boolean {
  return (
    !q.text && !q.kinds.length && !q.labels.length && !q.folders.length && !q.starred && !q.pinned
  );
}

export interface Hit {
  item: Item;
  /** Character range in the title that matched the free-text term. */
  match: { start: number; end: number } | null;
  score: number;
}

function haystack(item: Item): string {
  return fold(
    [
      item.title,
      item.body,
      item.username,
      item.url,
      item.secureNote,
      item.labels.join(' '),
      // Secrets are deliberately excluded: search must not leak them, and the
      // design promises the vault shows titles only while locked.
    ].join(' '),
  );
}

export function search(items: Item[], folders: Folder[], raw: string): Hit[] {
  const q = parseQuery(raw);
  if (isEmptyQuery(q)) return [];

  const folderName = new Map(folders.map((f) => [f.id, fold(f.name)]));
  const term = fold(q.text);
  const hits: Hit[] = [];

  for (const item of items) {
    if (q.kinds.length && !q.kinds.includes(item.kind)) continue;
    if (q.starred && !item.starred) continue;
    if (q.pinned && !item.pinned) continue;
    if (q.labels.length && !q.labels.every((l) => item.labels.some((x) => fold(x) === l))) continue;
    if (q.folders.length) {
      const name = item.folderId ? folderName.get(item.folderId) ?? '' : '';
      if (!q.folders.every((f) => name.includes(f))) continue;
    }

    let match: Hit['match'] = null;
    let score = 0;

    if (term) {
      const title = fold(item.title);
      const at = title.indexOf(term);
      if (at >= 0) {
        match = { start: at, end: at + term.length };
        // A title hit beats a body hit; an early hit beats a late one.
        score = 100 - at + (at === 0 ? 20 : 0);
      } else if (haystack(item).includes(term)) {
        score = 40;
      } else {
        // Fall back to prefix matching on every word, so "dep" finds "deploy".
        const words = term.split(/\s+/);
        if (!words.every((w) => haystack(item).includes(w))) continue;
        score = 20;
      }
    } else {
      score = 10;
    }

    score += item.pinned ? 6 : 0;
    score += item.starred ? 4 : 0;
    hits.push({ item, match, score });
  }

  return hits.sort((a, b) => b.score - a.score);
}

/** Counts per kind for the palette's filter chips. */
export function countByKind(items: Item[]): Record<Kind, number> {
  const out = { note: 0, login: 0, secret: 0, person: 0, task: 0, link: 0 } as Record<Kind, number>;
  for (const it of items) out[it.kind]++;
  return out;
}
