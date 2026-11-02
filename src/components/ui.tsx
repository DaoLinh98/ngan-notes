import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { KIND } from '../lib/kind';
import type { Kind } from '../lib/types';
import { colorize, mask } from '../lib/format';
import { useSession } from '../lib/session';
import { useT } from '../lib/i18n';

/* ── Buttons ─────────────────────────────────────────────────────────── */

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconAfter?: IconName;
  full?: boolean;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  className?: string;
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  full,
  disabled,
  title,
  type = 'button',
  className,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={['btn', `btn-${variant}`, `btn-${size}`, full && 'btn-full', className]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 17} strokeWidth={variant === 'primary' ? 2 : 1.8} />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} size={16} />}
    </button>
  );
}

/** A square icon-only button — the row of tools above an open item. */
export function IconButton({
  name,
  label,
  onClick,
  active,
  color,
  size = 36,
  iconSize = 17,
  filled,
}: {
  name: IconName;
  label: string;
  onClick?: () => void;
  active?: boolean;
  color?: string;
  size?: number;
  iconSize?: number;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={['icon-btn', active && 'is-active'].filter(Boolean).join(' ')}
      style={{ width: size, height: size, color }}
    >
      <Icon name={name} size={iconSize} filled={filled} />
    </button>
  );
}

/* ── Kind badge ──────────────────────────────────────────────────────── */

export function KindBadge({ kind, short }: { kind: Kind; short?: boolean }) {
  const { t } = useT();
  const meta = KIND[kind];
  const label = t(`kind.${kind}.name`);
  return (
    <span
      className="kind-badge"
      style={{ background: meta.bg, color: meta.color }}
      title={label}
    >
      <Icon name={meta.icon} size={14} />
      {short ? label.split(' ')[0] : label}
    </span>
  );
}

/** The 36/40/44px rounded tile holding a kind icon or a credential initial. */
export function Avatar({
  kind,
  size = 36,
  label,
  mono,
}: {
  kind: Kind;
  size?: number;
  label?: string;
  mono?: boolean;
}) {
  const meta = KIND[kind];
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: meta.bg,
        color: meta.color,
        borderRadius: size * 0.3,
        fontSize: size * 0.4,
        fontFamily: mono ? 'var(--mono)' : undefined,
      }}
    >
      {label ?? <Icon name={meta.icon} size={size * 0.5} />}
    </span>
  );
}

/* ── Chips & pills ───────────────────────────────────────────────────── */

export function Chip({
  children,
  dot,
  active,
  color,
  onClick,
  count,
}: {
  children: ReactNode;
  dot?: string;
  active?: boolean;
  color?: string;
  onClick?: () => void;
  count?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={['chip', active && 'is-active'].filter(Boolean).join(' ')}
      style={!active && color ? { color } : undefined}
    >
      {dot && <span className="chip-dot" style={{ background: dot }} />}
      {children}
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  );
}

export function LabelPill({ label, onClick }: { label: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className="label-pill" onClick={onClick} type={onClick ? 'button' : undefined}>
      #{label}
    </Tag>
  );
}

/* ── Secret field ────────────────────────────────────────────────────── */

interface SecretProps {
  value: string;
  /** Reveal state is owned by the session so blur/auto-lock can clear it. */
  revealed: boolean;
  onToggle: () => void;
  onCopy: () => void;
  /** Colour the revealed text by character class, as the design does. */
  colorful?: boolean;
  size?: number;
  /** Show a partial prefix while masked, e.g. `AKIA••••`. */
  prefix?: number;
  copyLabel?: string;
}

export function SecretField({
  value,
  revealed,
  onToggle,
  onCopy,
  colorful,
  size = 18,
  prefix = 0,
  copyLabel,
}: SecretProps) {
  const { t } = useT();
  const shown = revealed ? value : mask(value, prefix);
  const runs = colorful && revealed ? colorize(shown) : null;

  return (
    <div className="secret-field">
      <span
        className="secret-value mono"
        style={{ fontSize: size, letterSpacing: revealed ? '0.04em' : '0.14em' }}
        data-revealed={revealed || undefined}
      >
        {runs
          ? runs.map((r, i) => (
              <span
                key={i}
                style={
                  r.tone === 'symbol'
                    ? { color: 'var(--k-login)' }
                    : r.tone === 'digit'
                      ? { color: 'var(--k-note)' }
                      : undefined
                }
              >
                {r.text}
              </span>
            ))
          : shown}
      </span>
      <IconButton
        name={revealed ? 'eyeoff' : 'eye'}
        label={revealed ? t('ui.hide') : t('ui.show')}
        onClick={onToggle}
        size={40}
      />
      <IconButton name="copy" label={copyLabel ?? t('ui.copy')} onClick={onCopy} size={40} active />
    </div>
  );
}

/* ── Strength meter ──────────────────────────────────────────────────── */

export function StrengthMeter({ score, label }: { score: number; label: string }) {
  const tone = score >= 3 ? 'var(--accent)' : score === 2 ? 'var(--warn)' : 'var(--danger)';
  return (
    <div className="strength">
      <div className="strength-bars">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ background: i < score ? tone : 'var(--border-strong)' }} />
        ))}
      </div>
      <span className="strength-label">{label}</span>
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────── */

export function Modal({
  children,
  onClose,
  label,
  width = 560,
  height,
  align = 'center',
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  width?: number | string;
  height?: number | string;
  align?: 'center' | 'bottom';
}) {
  return (
    <div className={`scrim scrim-${align}`} onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`modal modal-${align}`}
        style={{ maxWidth: width, height }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Toasts ──────────────────────────────────────────────────────────── */

export function ToastStack() {
  const { toasts, dismissToast } = useSession();
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className="toast"
          data-tone={t.tone}
          onClick={() => dismissToast(t.id)}
        >
          <Icon name={t.tone === 'warn' ? 'warn' : 'check'} size={18} strokeWidth={2.2} />
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Small helpers ───────────────────────────────────────────────────── */

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="section-label" style={style}>
      {children}
    </div>
  );
}

/** A labelled input row used throughout the credential detail panes. */
export function Field({
  label,
  value,
  mono,
  hint,
  children,
  onCopy,
  copyLabel,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  hint?: ReactNode;
  children?: ReactNode;
  onCopy?: () => void;
  copyLabel?: string;
}) {
  const { t } = useT();
  return (
    <div className="field">
      <div className="field-main">
        <span className="field-label">{label}</span>
        {children ?? (
          <span className={mono ? 'field-value mono' : 'field-value'}>{value || '—'}</span>
        )}
        {hint}
      </div>
      {onCopy && (
        <IconButton name="copy" label={copyLabel ?? t('ui.copyLabel', { label })} onClick={onCopy} size={40} />
      )}
    </div>
  );
}
