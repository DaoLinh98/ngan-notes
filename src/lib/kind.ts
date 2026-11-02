import type { IconName } from '../components/Icon';
import type { Kind } from './types';
import { tr, type TKey } from './i18n';

export interface KindMeta {
  label: string;
  color: string;
  bg: string;
  icon: IconName;
}

const COLORS: Record<Kind, Omit<KindMeta, 'label'>> = {
  note: { color: '#7AB8FF', bg: 'rgba(122,184,255,0.14)', icon: 'note' },
  login: { color: '#FFB547', bg: 'rgba(255,181,71,0.14)', icon: 'login' },
  secret: { color: '#B79CFF', bg: 'rgba(183,156,255,0.14)', icon: 'code' },
  person: { color: '#4FD6C4', bg: 'rgba(79,214,196,0.14)', icon: 'person' },
  task: { color: '#FF7A70', bg: 'rgba(255,122,112,0.14)', icon: 'task' },
  link: { color: '#F08CE0', bg: 'rgba(240,140,224,0.14)', icon: 'link' },
};

export const KIND_ORDER: Kind[] = ['note', 'login', 'secret', 'person', 'task', 'link'];

/** Builds a per-kind record whose values are read through the active language. */
function translated<V>(make: (k: Kind) => V): Record<Kind, V> {
  const out = {} as Record<Kind, V>;
  for (const k of KIND_ORDER) Object.defineProperty(out, k, { get: () => make(k), enumerable: true });
  return out;
}

/** One colour and one icon per kind — the spine of the whole interface. */
export const KIND: Record<Kind, KindMeta> = translated((k) => ({
  ...COLORS[k],
  label: tr(`kind.${k}.name` as TKey),
}));

/** Short label used on filter chips and compact tiles. */
export const KIND_SHORT: Record<Kind, string> = translated((k) => tr(`kind.${k}.short` as TKey));

/** One line saying what each kind is for, shown on the create picker. */
export const KIND_BLURB: Record<Kind, string> = translated((k) => tr(`kind.${k}.blurb` as TKey));

export const sameKind = (a: Kind, b: Kind) => a === b;
