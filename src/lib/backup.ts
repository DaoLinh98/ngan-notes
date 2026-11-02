/**
 * Automatic file backups.
 *
 * IndexedDB holds the only copy of the vault, so clearing site data wipes
 * everything. When auto-backup is on, every change to the item list writes the
 * same sealed envelope the manual export produces to a file outside the
 * browser.
 *
 * Where that file goes depends on what the browser offers. The File System
 * Access API lets the user pick a file once and we overwrite it on every
 * write, which keeps the Downloads folder clean. Without it we fall back to a
 * download, with a timestamp in the name so successive backups do not collide.
 */

import { loadBackupHandle, saveBackupHandle } from './db';
import type { BackupTarget } from './types';
import { tr } from './i18n';

/** The file auto-backup overwrites, once the user has picked one. */
let handle: FileSystemFileHandle | null = null;

export const pickerSupported = (): boolean => 'showSaveFilePicker' in window;

/** `ngan-backup-2026-10-28-17-08-32.json` — to the second, so names differ. */
export function backupFilename(at = new Date()): string {
  const stamp = at.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `ngan-backup-${stamp}.json`;
}

/** Re-attaches the file picked in an earlier session, if the browser kept it. */
export async function restoreBackupTarget(): Promise<string | null> {
  if (!pickerSupported()) return null;
  try {
    handle = (await loadBackupHandle()) ?? null;
  } catch {
    handle = null;
  }
  return handle?.name ?? null;
}

/**
 * Opens the save picker and remembers the file. The browser requires a user
 * gesture, so this only works straight from a click.
 */
export async function pickBackupTarget(): Promise<string | null> {
  if (!pickerSupported()) return null;
  try {
    const picked = await window.showSaveFilePicker({
      suggestedName: backupFilename(),
      types: [{ description: tr('backup.fileDesc', { app: tr('app.name') }), accept: { 'application/json': ['.json'] } }],
    });
    // Ask for write access while the click is still the current gesture — the
    // debounced writes that follow have no gesture to spend on a prompt.
    await picked.requestPermission({ mode: 'readwrite' });
    handle = picked;
    await saveBackupHandle(picked);
    return picked.name;
  } catch {
    // The user cancelled, or the browser refused to hand out the handle.
    return null;
  }
}

/**
 * Writes the envelope to the picked file, or downloads it when there is no
 * usable handle. Says which of the two happened.
 */
export async function writeBackup(json: string): Promise<BackupTarget> {
  const target = handle;
  if (target && (await canWrite(target))) {
    try {
      const writable = await target.createWritable();
      await writable.write(json);
      await writable.close();
      return 'file';
    } catch {
      // The file was moved or deleted since it was picked — fall through.
    }
  }
  downloadBackup(json);
  return 'download';
}

async function canWrite(h: FileSystemFileHandle): Promise<boolean> {
  try {
    return (await h.queryPermission({ mode: 'readwrite' })) === 'granted';
  } catch {
    return false;
  }
}

/** The manual "Tải bản sao lưu" path, and the fallback for auto-backup. */
export function downloadBackup(json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  a.click();
  // Revoking in the same tick can cancel the download before it starts.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
