import type { CSSProperties } from 'react';

/**
 * Every glyph in the app, as stroked paths on a 24×24 grid — the same
 * vocabulary the design uses. Paths come straight from the design source.
 */

export const PATHS = {
  plus: 'M12 5v14 M5 12h14',
  search: 'M11 18a7 7 0 1 1 0-14a7 7 0 0 1 0 14z M21 21l-5-5',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 7.5-2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9c-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0z',
  eyeoff:
    'M3 3l18 18 M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9 M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  copy: 'M8 8h12v12H8z M16 8V4H4v12h4',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  folder: 'M3 6h6l2 2h10v11H3z',
  pin: 'M9 4h6 M10 4v6l-3 4h10l-3-4V4 M12 14v7',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0',
  clock: 'M12 21a9 9 0 1 1 0-18a9 9 0 0 1 0 18z M12 7v5l3 2',
  globe: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  history: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10',
  sliders: 'M4 7h10 M18 7h2 M16 5v4 M4 17h4 M12 17h8 M10 15v4',
  sun: 'M12 16a4 4 0 1 1 0-8a4 4 0 0 1 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  ext: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
  code: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  login: 'M12 15a4 4 0 1 1-8 0a4 4 0 0 1 8 0z M11 12l9-9 M17 6l3 3 M15 8l2 2',
  person:
    'M3 5h18v14H3z M11.5 10a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0z M7 15.5c.6-1.6 1.7-2.5 3-2.5s2.4.9 3 2.5 M15 9h3 M15 13h3',
  task: 'M4 4h16v16H4z M8 12l3 3 5-6',
  warn: 'M12 4l9 16H3z M12 10v4 M12 17h.01',
  wand: 'M4 20L16 8 M14 4v2 M18 8h2 M19 4l-1 1 M18 11l1 1',
  finger: 'M12 11v4 M8 13a4 4 0 0 1 8 0v2a8 8 0 0 1-1 4 M5 12a7 7 0 0 1 14 0v1 M9 21a10 10 0 0 0 1-5v-3a2 2 0 0 1 4 0',
  face: 'M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M9 9v1 M15 9v1 M12 9v4h-1 M9 16c1.5 1 4.5 1 6 0',
  cloud: 'M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z',
  devices: 'M3 5h13v10H3z M7 19h5 M18 9h3v10h-3z',
  key: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M14 4l-4 16',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 20h16',
  upload: 'M12 21V9 M7 14l5-5 5 5 M4 4h16',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  filter: 'M4 6h16 M7 12h10 M10 18h4',
  sort: 'M7 4v16 M4 17l3 3 3-3 M17 20V4 M14 7l3-3 3 3',
  note: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
} as const;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  /** Fill the glyph instead of stroking it — used for the starred state. */
  filled?: boolean;
}

export function Icon({ name, size = 18, strokeWidth = 1.8, className, style, filled }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1.6 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The Ngăn mark: two shelves, the lower one filled with the accent. */
export function Logo({ size = 30 }: { size?: number }) {
  const s = size / 56;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true" focusable="false">
      <rect
        x="1"
        y="1"
        width="54"
        height="54"
        rx="16"
        fill="var(--surface-2)"
        stroke="var(--border-strong)"
      />
      <rect
        x="14"
        y="16"
        width="28"
        height="9"
        rx="3"
        fill="none"
        stroke="var(--text)"
        strokeWidth={3 * s * 1.4}
      />
      <rect x="14" y="31" width="28" height="9" rx="3" fill="var(--accent)" />
    </svg>
  );
}
