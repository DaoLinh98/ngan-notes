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
import { useStore } from './store';
import { tr } from './i18n';

/**
 * Ephemeral, never-persisted UI state: which secrets are revealed right now,
 * the clipboard countdown, and the vault's idle timer.
 *
 * Reveals and clipboard clears are deliberately short-lived — the design
 * promises "che mặc định" and "tự xoá sau 30 giây", so both are enforced
 * here rather than left to the components.
 */

interface Toast {
  id: string;
  text: string;
  tone: 'default' | 'warn';
}

interface Session {
  /** Item ids whose secret is currently visible. */
  revealed: Set<string>;
  toggleReveal: (id: string) => void;
  hideReveal: (id: string) => void;
  /** Copies text and arms the clipboard wipe. */
  copy: (text: string, label?: string) => void;
  /** Seconds left before the clipboard is cleared, or 0 when idle. */
  clipboardLeft: number;
  toasts: Toast[];
  notify: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  /** Milliseconds the vault has been open, for the "04:52" badge. */
  vaultSeconds: number;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // `lock` chỉ dùng trong effect tự khoá đang bị comment tắt bên dưới.
  const { settings, status } = useStore();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clipboardLeft, setClipboardLeft] = useState(0);
  const [vaultSeconds, setVaultSeconds] = useState(0);

  const revealTimers = useRef(new Map<string, number>());
  const clipboardTimer = useRef<number | null>(null);
  const clipboardValue = useRef<string | null>(null);

  const notify = useCallback((text: string, tone: Toast['tone'] = 'default') => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const hideReveal = useCallback((id: string) => {
    const timer = revealTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    revealTimers.current.delete(id);
    setRevealed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleReveal = useCallback(
    (id: string) => {
      setRevealed((prev) => {
        if (prev.has(id)) {
          const timer = revealTimers.current.get(id);
          if (timer) window.clearTimeout(timer);
          revealTimers.current.delete(id);
          const next = new Set(prev);
          next.delete(id);
          return next;
        }
        // Re-mask on its own, so a secret left on screen doesn't stay there.
        const timer = window.setTimeout(() => hideReveal(id), settings.revealSeconds * 1000);
        revealTimers.current.set(id, timer);
        return new Set(prev).add(id);
      });
    },
    [hideReveal, settings.revealSeconds],
  );

  const copy = useCallback(
    (text: string, label = tr('session.content')) => {
      const done = () => {
        notify(tr('session.copied', { label, n: settings.clipboardClearSeconds }));
        clipboardValue.current = text;
        setClipboardLeft(settings.clipboardClearSeconds);
        if (clipboardTimer.current) window.clearInterval(clipboardTimer.current);
        clipboardTimer.current = window.setInterval(() => {
          setClipboardLeft((left) => {
            if (left <= 1) {
              if (clipboardTimer.current) window.clearInterval(clipboardTimer.current);
              clipboardTimer.current = null;
              // Best effort: only overwrite if nothing else took the clipboard.
              void navigator.clipboard
                ?.writeText('')
                .then(() => {
                  clipboardValue.current = null;
                })
                .catch(() => undefined);
              return 0;
            }
            return left - 1;
          });
        }, 1000);
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done, () => {
          notify(tr('session.copyFail'), 'warn');
        });
      } else {
        // Fallback for insecure origins, where the async clipboard is absent.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          done();
        } catch {
          notify(tr('session.copyFail'), 'warn');
        }
        document.body.removeChild(ta);
      }
    },
    [notify, settings.clipboardClearSeconds],
  );

  // Vault idle timer: any of these events pushes the deadline back.
  // TẠM TẮT (comment) để không bị tự khoá liên tục trong lúc đang làm việc.
  // Muốn bật lại: bỏ dấu /* */ bao quanh khối useEffect bên dưới.
  /*
  useEffect(() => {
    if (status !== 'unlocked') return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const tick = window.setInterval(() => {
      if (Date.now() - last >= settings.autoLockMinutes * 60_000) {
        notify(tr('session.autoLocked'), 'warn');
        lock();
      }
    }, 5000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(tick);
    };
  }, [status, settings.autoLockMinutes, lock, notify]);
  */

  // "Che nội dung khi chuyển ứng dụng" — blur hides everything and re-masks.
  // TẠM TẮT (comment) cùng lý do: tránh bị ẩn/khoá khi đổi cửa sổ lúc đang làm việc.
  /*
  useEffect(() => {
    if (status !== 'unlocked' || !settings.hideOnBlur) return;
    const onBlur = () => {
      setRevealed(new Set());
      revealTimers.current.forEach((t) => window.clearTimeout(t));
      revealTimers.current.clear();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [status, settings.hideOnBlur]);
  */

  // The vault-open badge counts up from zero each time it is opened.
  useEffect(() => {
    if (status !== 'unlocked') {
      setVaultSeconds(0);
      return;
    }
    const start = Date.now();
    const t = window.setInterval(() => setVaultSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [status]);

  useEffect(
    () => () => {
      revealTimers.current.forEach((t) => window.clearTimeout(t));
      if (clipboardTimer.current) window.clearInterval(clipboardTimer.current);
    },
    [],
  );

  const value = useMemo<Session>(
    () => ({
      revealed,
      toggleReveal,
      hideReveal,
      copy,
      clipboardLeft,
      toasts,
      notify,
      dismissToast,
      vaultSeconds,
    }),
    [revealed, toggleReveal, hideReveal, copy, clipboardLeft, toasts, notify, dismissToast, vaultSeconds],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

/** "04:52" */
export const mmss = (total: number): string =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
