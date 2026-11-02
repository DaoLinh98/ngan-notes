/** The six kinds of information Ngăn stores. Each has one colour and one icon. */
export type Kind = 'note' | 'login' | 'secret' | 'person' | 'task' | 'link';

/** Kinds that live in the vault: hidden by default, require verification. */
export const VAULT_KINDS: Kind[] = ['login', 'secret', 'person'];

export const isVaultKind = (k: Kind): boolean => VAULT_KINDS.includes(k);

export interface Folder {
  id: string;
  name: string;
  color: string;
}

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  /** Body for notes; unused for credentials. */
  body: string;
  /** Folder id, or null for unfiled. */
  folderId: string | null;
  labels: string[];
  /** Username / login name. */
  username: string;
  /** Password, API key, secret — the field that gets masked. */
  secret: string;
  /** TOTP seed, rendered as a live 6-digit code. */
  totp: string;
  url: string;
  /** Free-form secure note attached to a credential. */
  secureNote: string;
  /** Checklist for `task` items. */
  todos: Todo[];
  pinned: boolean;
  starred: boolean;
  /** ISO date, or null. */
  remindAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export interface Settings {
  theme: 'dark' | 'light';
  /** Minutes of idle before the vault re-locks. */
  autoLockMinutes: number;
  /** Seconds a copied secret stays on the clipboard before being cleared. */
  clipboardClearSeconds: number;
  /** Seconds a revealed secret stays visible before re-masking. */
  revealSeconds: number;
  hideOnBlur: boolean;
  biometric: boolean;
  /** Write a backup file after every change to the item list. */
  autoBackup: boolean;
}

/**
 * Where auto-backup writes. `file` is a file the user picked once and we
 * overwrite; `download` is the fallback for browsers without the picker, where
 * every write lands in the Downloads folder under a fresh name.
 */
export type BackupTarget = 'file' | 'download';

export interface Vault {
  /** PBKDF2 salt, base64. */
  salt: string;
  /** AES-GCM IV used for the verifier, base64. */
  iv: string;
  /** Encrypted known plaintext — proves the master password without storing it. */
  verifier: string;
  /** AES-GCM IV used for the payload, base64. */
  dataIv: string;
  /** Encrypted JSON payload, base64. */
  data: string;
  updatedAt: string;
}

export interface Payload {
  items: Item[];
  folders: Folder[];
  settings: Settings;
}
