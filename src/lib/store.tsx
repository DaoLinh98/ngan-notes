import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { clearVault, loadVault, requestPersistentStorage, saveVault } from './db';
import { reseal, seal, unseal } from './crypto';
import { tr } from './i18n';
import { pickBackupTarget, pickerSupported, restoreBackupTarget, writeBackup } from './backup';
import { DEFAULT_FOLDERS, DEFAULT_SETTINGS, SEED_PAYLOAD, isSeedItem } from './seed';
import type { Folder, Item, Payload, Settings, Vault } from './types';

export type VaultStatus = 'loading' | 'setup' | 'locked' | 'unlocked';

interface Store {
  status: VaultStatus;
  items: Item[];
  folders: Folder[];
  settings: Settings;
  /** True while a biometric/PIN prompt is standing in for the master password. */
  unlockedByBiometric: boolean;
  createVault: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  /** Opens the vault without the password — the "Touch ID / Face ID" path. */
  unlockWithBiometric: () => void;
  lock: () => void;
  reset: () => Promise<void>;
  changeMasterPassword: (current: string, next: string) => Promise<void>;
  addItem: (draft: Partial<Item> & { kind: Item['kind']; title: string }) => Item;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;
  /** Bulk delete: one re-encrypt and one write for the whole set. */
  removeItems: (ids: string[]) => void;
  /** Drops the demo content a new vault starts with. */
  removeSeedItems: () => void;
  addFolder: (name: string, color: string) => Folder;
  updateSettings: (patch: Partial<Settings>) => void;
  exportBackup: () => string;
  importBackup: (json: string) => Promise<void>;
  /** Name of the file auto-backup overwrites, or null when none is picked. */
  backupFileName: string | null;
  /** True when the browser can overwrite a picked file instead of downloading. */
  canPickBackupFile: boolean;
  /** Opens the save picker. Returns the file name, or null if cancelled. */
  chooseBackupFile: () => Promise<string | null>;
}

const Ctx = createContext<Store | null>(null);

const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

/** How long edits settle before an auto-backup runs. */
const BACKUP_DEBOUNCE_MS = 3000;

/** The envelope format shared by the manual export, import and auto-backup. */
function backupJson(vault: Vault): string {
  return JSON.stringify({ app: 'ngan', version: 1, vault }, null, 2);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('loading');
  const [vault, setVault] = useState<Vault | null>(null);
  const [payload, setPayload] = useState<Payload>(SEED_PAYLOAD);
  const [unlockedByBiometric, setUnlockedByBiometric] = useState(false);
  const [backupFileName, setBackupFileName] = useState<string | null>(null);
  const [canPickBackupFile] = useState(pickerSupported);

  // The master password lives only here, only while unlocked, and never
  // reaches IndexedDB. Losing it on reload is the point.
  const passwordRef = useRef<string | null>(null);
  const vaultRef = useRef<Vault | null>(null);
  vaultRef.current = vault;

  // Read by the debounced backup, which fires long after the render that
  // scheduled it. Same reason persist() reads vaultRef rather than state.
  const settingsRef = useRef<Settings>(payload.settings);
  settingsRef.current = payload.settings;

  const backupTimer = useRef<number | null>(null);

  useEffect(() => {
    // Ask before the first write, so the browser keeps the vault rather than
    // evicting it under storage pressure.
    void requestPersistentStorage();
    void restoreBackupTarget().then(setBackupFileName);
    loadVault()
      .then((v) => {
        setVault(v ?? null);
        setStatus(v ? 'locked' : 'setup');
      })
      .catch(() => setStatus('setup'));
  }, []);

  /**
   * Runs the pending backup right now. Called when the tab goes away, so an
   * edit made in the last few seconds is not lost with the debounce timer.
   */
  const flushBackup = useCallback(() => {
    if (backupTimer.current === null) return;
    window.clearTimeout(backupTimer.current);
    backupTimer.current = null;
    const v = vaultRef.current;
    if (v) void writeBackup(backupJson(v));
  }, []);

  const scheduleBackup = useCallback(() => {
    if (backupTimer.current !== null) window.clearTimeout(backupTimer.current);
    backupTimer.current = window.setTimeout(() => {
      backupTimer.current = null;
      const v = vaultRef.current;
      if (v) void writeBackup(backupJson(v));
    }, BACKUP_DEBOUNCE_MS);
  }, []);

  const persist = useCallback(
    async (next: Payload, password: string, itemsChanged: boolean) => {
      const current = vaultRef.current;
      if (!current) return;
      const sealed = await reseal(password, current, next);
      const withTime: Vault = { ...sealed, updatedAt: nowIso() };
      setVault(withTime);
      await saveVault(withTime);
      if (itemsChanged && settingsRef.current.autoBackup) scheduleBackup();
    },
    [scheduleBackup],
  );

  const createVault = useCallback(async (password: string) => {
    const sealed = await seal(password, SEED_PAYLOAD);
    const v: Vault = { ...sealed, updatedAt: nowIso() };
    passwordRef.current = password;
    setVault(v);
    setPayload(SEED_PAYLOAD);
    setStatus('unlocked');
    await saveVault(v);
  }, []);

  const unlock = useCallback(
    async (password: string) => {
      const current = vaultRef.current;
      if (!current) throw new Error(tr('err.noVaultToOpen'));
      const data = await unseal<Payload>(password, current);
      passwordRef.current = password;
      setPayload({
        items: data.items ?? [],
        folders: data.folders?.length ? data.folders : DEFAULT_FOLDERS,
        settings: { ...DEFAULT_SETTINGS, ...data.settings },
      });
      setUnlockedByBiometric(false);
      setStatus('unlocked');
    },
    [],
  );

  const unlockWithBiometric = useCallback(() => {
    // A real build would gate this behind WebAuthn and a device-bound key.
    // Here it stands in for the OS prompt so the flow can be walked through.
    setUnlockedByBiometric(true);
    setStatus('unlocked');
  }, []);

  const lock = useCallback(() => {
    flushBackup();
    passwordRef.current = null;
    setUnlockedByBiometric(false);
    setStatus('locked');
  }, [flushBackup]);

  const reset = useCallback(async () => {
    await clearVault();
    passwordRef.current = null;
    setVault(null);
    setPayload(SEED_PAYLOAD);
    setStatus('setup');
  }, []);

  const changeMasterPassword = useCallback(
    async (current: string, next: string) => {
      const v = vaultRef.current;
      if (!v) throw new Error(tr('err.noVault'));
      // Verify against the live envelope before re-sealing under the new key.
      await unseal<Payload>(current, v);
      const sealed = await seal(next, payload);
      const updated: Vault = { ...sealed, updatedAt: nowIso() };
      passwordRef.current = next;
      setVault(updated);
      await saveVault(updated);
    },
    [payload],
  );

  const mutate = useCallback(
    (fn: (p: Payload) => Payload) => {
      setPayload((prev) => {
        const next = fn(prev);
        const pw = passwordRef.current;
        // Every item mutation builds a fresh items array; folders and settings
        // keep the same reference. That is what tells the two apart here,
        // without every call site having to say which it is doing.
        if (pw) void persist(next, pw, next.items !== prev.items);
        return next;
      });
    },
    [persist],
  );

  const addItem = useCallback<Store['addItem']>(
    (draft) => {
      const item: Item = {
        id: uid(),
        body: '',
        folderId: null,
        labels: [],
        username: '',
        secret: '',
        totp: '',
        url: '',
        secureNote: '',
        todos: [],
        pinned: false,
        starred: false,
        remindAt: null,
        createdAt: nowIso(),
        ...draft,
        updatedAt: nowIso(),
      };
      mutate((p) => ({ ...p, items: [item, ...p.items] }));
      return item;
    },
    [mutate],
  );

  const updateItem = useCallback<Store['updateItem']>(
    (id, patch) => {
      mutate((p) => ({
        ...p,
        items: p.items.map((it) => (it.id === id ? { ...it, ...patch, updatedAt: nowIso() } : it)),
      }));
    },
    [mutate],
  );

  const removeItems = useCallback<Store['removeItems']>(
    (ids) => {
      if (!ids.length) return;
      // One mutate for the whole set: persist() re-encrypts the payload once,
      // so deleting 30 items costs one PBKDF2 round, not thirty.
      const drop = new Set(ids);
      mutate((p) => ({ ...p, items: p.items.filter((it) => !drop.has(it.id)) }));
    },
    [mutate],
  );

  const removeItem = useCallback<Store['removeItem']>(
    (id) => removeItems([id]),
    [removeItems],
  );

  const removeSeedItems = useCallback<Store['removeSeedItems']>(
    () => mutate((p) => ({ ...p, items: p.items.filter((it) => !isSeedItem(it)) })),
    [mutate],
  );

  const addFolder = useCallback<Store['addFolder']>(
    (name, color) => {
      const folder: Folder = { id: uid(), name, color };
      mutate((p) => ({ ...p, folders: [...p.folders, folder] }));
      return folder;
    },
    [mutate],
  );

  const updateSettings = useCallback<Store['updateSettings']>(
    (patch) => mutate((p) => ({ ...p, settings: { ...p.settings, ...patch } })),
    [mutate],
  );

  const exportBackup = useCallback(() => {
    const v = vaultRef.current;
    if (!v) throw new Error(tr('err.noVault'));
    return backupJson(v);
  }, []);

  const chooseBackupFile = useCallback(async () => {
    const name = await pickBackupTarget();
    if (name) setBackupFileName(name);
    return name;
  }, []);

  const importBackup = useCallback(async (json: string) => {
    const parsed = JSON.parse(json) as { app?: string; vault?: Vault };
    if (parsed.app !== 'ngan' || !parsed.vault) throw new Error(tr('err.badBackup'));
    await saveVault(parsed.vault);
    setVault(parsed.vault);
    passwordRef.current = null;
    setStatus('locked');
  }, []);

  // Theme is applied to <html> so tokens.css can switch on the attribute,
  // including before the vault is unlocked.
  useEffect(() => {
    document.documentElement.dataset.theme = payload.settings.theme;
  }, [payload.settings.theme]);

  // A tab being hidden is the last reliable moment to write a backup that is
  // still sitting on the debounce timer.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushBackup();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flushBackup]);

  const value = useMemo<Store>(
    () => ({
      status,
      items: payload.items,
      folders: payload.folders,
      settings: payload.settings,
      unlockedByBiometric,
      createVault,
      unlock,
      unlockWithBiometric,
      lock,
      reset,
      changeMasterPassword,
      addItem,
      updateItem,
      removeItem,
      removeItems,
      removeSeedItems,
      addFolder,
      updateSettings,
      exportBackup,
      importBackup,
      backupFileName,
      canPickBackupFile,
      chooseBackupFile,
    }),
    [
      status,
      payload,
      unlockedByBiometric,
      createVault,
      unlock,
      unlockWithBiometric,
      lock,
      reset,
      changeMasterPassword,
      addItem,
      updateItem,
      removeItem,
      removeItems,
      removeSeedItems,
      addFolder,
      updateSettings,
      exportBackup,
      importBackup,
      backupFileName,
      canPickBackupFile,
      chooseBackupFile,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
