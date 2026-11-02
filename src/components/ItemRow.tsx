import { Avatar } from './ui';
import { Icon } from './Icon';
import { KIND } from '../lib/kind';
import { count, initial, mask, reminderLabel, timeAgo } from '../lib/format';
import { isVaultKind, type Item } from '../lib/types';
import { useT, type T } from '../lib/i18n';

/**
 * One row in the middle column. The subtitle is kind-aware: a credential shows
 * a masked secret, a task shows its progress, a link shows its host. Nothing
 * sensitive is rendered here — a locked vault shows titles only.
 */

export function subtitle(item: Item, locked: boolean, t: T): string {
  const vaultLine = () => t('ui.row.locked', { kind: t(`kind.${item.kind}.name`) });
  switch (item.kind) {
    case 'login':
      return locked
        ? vaultLine()
        : `${item.username || t('ui.row.noUsername')} · ${mask(item.secret, 0)}`;
    case 'secret':
      return locked ? vaultLine() : mask(item.secret, 4);
    case 'person':
      return locked ? vaultLine() : mask(item.secret, 0);
    case 'task': {
      const done = item.todos.filter((td) => td.done).length;
      if (item.todos.length) return t('ui.row.todosDone', { done, total: item.todos.length });
      return item.remindAt
        ? t('item.remind', { when: reminderLabel(item.remindAt) })
        : t('ui.row.noTodos');
    }
    case 'link':
      return item.url.replace(/^https?:\/\//, '') || t('ui.row.noUrl');
    default:
      return item.body.split('\n')[0].slice(0, 80) || t('ui.row.emptyNote');
  }
}

/** Third line: folder, labels and a count, e.g. "#devops · 2/5 việc xong". */
function metaLine(item: Item, folderName: string | undefined, t: T): string {
  const bits: string[] = [];
  if (folderName) bits.push(folderName);
  if (item.labels.length) bits.push(item.labels.map((l) => `#${l}`).join(' '));
  if (item.kind === 'task' && item.todos.length) {
    bits.push(
      t('ui.row.todosDone', {
        done: item.todos.filter((td) => td.done).length,
        total: item.todos.length,
      }),
    );
  }
  return bits.join(' · ');
}

interface Props {
  item: Item;
  folderName?: string;
  selected?: boolean;
  locked: boolean;
  onOpen: () => void;
  /** Renders the credential initial instead of the kind icon. */
  asInitial?: boolean;
  /** Selection mode: the row toggles instead of opening, and shows a tick. */
  selecting?: boolean;
  checked?: boolean;
  onToggle?: () => void;
}

export function ItemRow({
  item,
  folderName,
  selected,
  locked,
  onOpen,
  asInitial,
  selecting,
  checked,
  onToggle,
}: Props) {
  const { t } = useT();
  const meta = metaLine(item, folderName, t);
  const sub = subtitle(item, locked && isVaultKind(item.kind), t);

  return (
    <button
      type="button"
      className={[
        'row',
        selected && 'is-selected',
        selecting && 'is-selecting',
        checked && 'is-checked',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selecting ? !!checked : undefined}
      onClick={selecting ? onToggle : onOpen}
    >
      {selecting && <Check checked={!!checked} />}
      <Avatar
        kind={item.kind}
        size={asInitial ? 40 : 36}
        mono={asInitial}
        label={asInitial ? initial(item.title) : undefined}
      />
      <span className="row-body">
        <span className="row-title">{item.title}</span>
        <span
          className="row-sub"
          style={item.kind === 'secret' || item.kind === 'login' ? { fontFamily: 'var(--mono)' } : undefined}
        >
          {sub}
        </span>
        {meta && <span className="row-meta">{meta}</span>}
      </span>
      <span className="row-time">{timeAgo(item.updatedAt)}</span>
    </button>
  );
}

/** The tick shown in selection mode. A span, not an input — the row is the
    button, and a checkbox nested inside one is invalid markup. */
export function Check({ checked }: { checked: boolean }) {
  return (
    <span className={`row-check${checked ? ' is-on' : ''}`} aria-hidden="true">
      {checked && <Icon name="check" size={14} strokeWidth={3} />}
    </span>
  );
}

/** Vault list row: avatar initial, title, masked value, and a health flag. */
export function VaultRow({
  item,
  selected,
  flag,
  onOpen,
  selecting,
  checked,
  onToggle,
}: {
  item: Item;
  selected?: boolean;
  flag?: { text: string; color: string };
  onOpen: () => void;
  selecting?: boolean;
  checked?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useT();
  return (
    <button
      type="button"
      className={[
        'vault-row',
        selected && 'is-selected',
        selecting && 'is-selecting',
        checked && 'is-checked',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selecting ? !!checked : undefined}
      onClick={selecting ? onToggle : onOpen}
    >
      {selecting && <Check checked={!!checked} />}
      <Avatar kind={item.kind} size={40} mono label={initial(item.title)} />
      <span className="row-body">
        <span className="row-title">{item.title}</span>
        <span className="row-sub">{subtitle(item, false, t)}</span>
      </span>
      {flag && (
        <span className="row-flag" style={{ color: flag.color }}>
          {flag.text}
        </span>
      )}
    </button>
  );
}

/** Compact tile grid used on the mobile home screen. */
export function KindTile({
  kind,
  label,
  total,
  onClick,
}: {
  kind: Item['kind'];
  label: string;
  total: number;
  onClick: () => void;
}) {
  const meta = KIND[kind];
  return (
    <button type="button" className="tile" onClick={onClick}>
      <span className="tile-icon" style={{ background: meta.bg, color: meta.color }}>
        <Icon name={meta.icon} size={17} />
      </span>
      <span className="tile-foot">
        <span className="tile-name">{label}</span>
        <span className="tile-count">{count(total)}</span>
      </span>
    </button>
  );
}
