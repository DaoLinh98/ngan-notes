import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Avatar, Chip, Empty } from '../components/ui';
import { KindTile, Check } from '../components/ItemRow';
import { SelectionBar } from '../components/SelectionBar';
import { KIND, KIND_ORDER } from '../lib/kind';
import { count, initial, longDate, mask, shortDate, timeAgo } from '../lib/format';
import { isSeedItem } from '../lib/seed';
import { search } from '../lib/search';
import { useSelection } from '../lib/useSelection';
import { isVaultKind, type Item, type Kind } from '../lib/types';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { tr, useT, type TKey } from '../lib/i18n';
import { useHealth } from './VaultPane';
import { MobileDetail } from './MobileDetail';
import { CreateItem } from './CreateItem';
import { RemindersWeek } from './RemindersPane';

/**
 * The phone shell. Not a narrow desktop: one column, thumb-sized targets, a
 * dock that keeps search and "add" reachable, and a four-tab bar. Vault
 * content stays masked until the user asks for it.
 */

type Route =
  | { name: 'home' }
  | { name: 'vault' }
  | { name: 'reminders' }
  | { name: 'settings' }
  | { name: 'search' }
  | { name: 'detail'; id: string };

const TABS: { name: Route['name']; label: TKey; icon: IconName }[] = [
  { name: 'home', label: 'mshell.home', icon: 'home' },
  { name: 'vault', label: 'mshell.vault', icon: 'lock' },
  { name: 'reminders', label: 'nav.reminders', icon: 'bell' },
  { name: 'settings', label: 'nav.settings', icon: 'sliders' },
];

/** Short kind label, e.g. "Khoá". */
const kindShort = (k: Kind) => tr(`kind.${k}.short` as TKey);

export function MobileShell({ onLock }: { onLock: () => void }) {
  const { t } = useT();
  const { vaultSeconds } = useSession();
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [adding, setAdding] = useState(false);

  const open = (id: string) => setRoute({ name: 'detail', id });
  const tab = route.name === 'detail' || route.name === 'search' ? 'home' : route.name;

  return (
    <div className="mobile">
      {route.name === 'home' && (
        <Home
          onOpen={open}
          onSearch={() => setRoute({ name: 'search' })}
          onVault={() => setRoute({ name: 'vault' })}
          onReminders={() => setRoute({ name: 'reminders' })}
          onAdd={() => setAdding(true)}
        />
      )}

      {route.name === 'vault' && (
        <VaultList
          onOpen={open}
          onBack={() => setRoute({ name: 'home' })}
          onLock={onLock}
          vaultSeconds={vaultSeconds}
        />
      )}

      {route.name === 'reminders' && (
        <Reminders onOpen={open} onBack={() => setRoute({ name: 'home' })} />
      )}

      {route.name === 'settings' && <Security onBack={() => setRoute({ name: 'home' })} />}

      {route.name === 'search' && (
        <MobileSearch onOpen={open} onClose={() => setRoute({ name: 'home' })} />
      )}

      {route.name === 'detail' && (
        <MobileDetail id={route.id} onBack={() => setRoute({ name: 'vault' })} />
      )}

      {adding && (
        <CreateItem
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            open(id);
          }}
        />
      )}

      {!adding && route.name !== 'detail' && (
        <nav className="tabbar bordered" aria-label={t('mshell.tabbar')}>
          {TABS.map((entry) => (
            <button
              key={entry.name}
              type="button"
              className={tab === entry.name ? 'is-active' : undefined}
              aria-current={tab === entry.name ? 'page' : undefined}
              onClick={() => setRoute({ name: entry.name } as Route)}
            >
              <Icon name={entry.icon} size={22} />
              {t(entry.label)}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

/* ── Home ────────────────────────────────────────────────────────────── */

function Home({
  onOpen,
  onSearch,
  onVault,
  onReminders,
  onAdd,
}: {
  onOpen: (id: string) => void;
  onSearch: () => void;
  onVault: () => void;
  onReminders: () => void;
  onAdd: () => void;
}) {
  const { t } = useT();
  const { items } = useStore();
  const [query, setQuery] = useState('');

  const byKind = useMemo(() => {
    const out = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<Kind, number>;
    for (const it of items) out[it.kind]++;
    return out;
  }, [items]);

  const pinned = useMemo(() => items.filter((i) => i.pinned).slice(0, 6), [items]);
  const recent = useMemo(
    () => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6),
    [items],
  );

  const hits = useMemo(
    () => (query.trim() ? search(items, [], query).slice(0, 12) : []),
    [items, query],
  );

  return (
    <>
      <div className="mobile-scroll has-dock">
        <div className="mobile-head">
          <div className="mobile-title">
            <span className="mobile-date">{shortDate()}</span>
            <h1>{t('mshell.title', { app: t('app.name') })}</h1>
          </div>
          <button type="button" className="round-btn is-flat" aria-label={t('mshell.account')}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>AS</span>
          </button>
        </div>

        <div className="mobile-tiles">
          {KIND_ORDER.map((k) => (
            <KindTile
              key={k}
              kind={k}
              label={kindShort(k)}
              total={byKind[k]}
              onClick={() => (isVaultKind(k) ? onVault() : onSearch())}
            />
          ))}
        </div>

        {pinned.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="mobile-section-head">
              <h2>{t('list.pinned')}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onSearch}>
                {t('mshell.seeAll')}
              </button>
            </div>
            <div className="hscroll">
              {pinned.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  className={`pin-card${i === 0 ? ' is-accent' : ''}`}
                  onClick={() => onOpen(it.id)}
                >
                  <span
                    className="pin-kind"
                    style={i === 0 ? undefined : { color: KIND[it.kind].color }}
                  >
                    <Icon name={isVaultKind(it.kind) ? 'lock' : 'pin'} size={14} strokeWidth={2} />
                    {kindShort(it.kind)}
                  </span>
                  <span className="pin-title">{it.title}</span>
                  <span className="pin-sub">
                    {isVaultKind(it.kind) ? (
                      <span className="mono">{mask(it.secret, 0)}</span>
                    ) : it.todos.length ? (
                      `${t('mshell.todosDone', {
                        done: it.todos.filter((todo) => todo.done).length,
                        total: it.todos.length,
                      })} · ${timeAgo(it.updatedAt)}`
                    ) : (
                      timeAgo(it.updatedAt)
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="mobile-section-head" style={{ paddingBottom: 6 }}>
            <h2>{t('nav.recent')}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onReminders}>
              {t('nav.reminders')}
            </button>
          </div>
          <div className="mobile-list">
            {recent.map((it) => (
              <button key={it.id} type="button" className="mobile-row" onClick={() => onOpen(it.id)}>
                <Avatar kind={it.kind} size={40} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span className="row-title">{it.title}</span>
                  <span className="row-sub">{mobileSubtitle(it)}</span>
                </span>
                <span className="row-time">{timeAgo(it.updatedAt)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dock is-static">
        {hits.length > 0 && (
          <div className="dock-results">
            {hits.map((h) => (
              <button
                key={h.item.id}
                type="button"
                className="mobile-row"
                onClick={() => onOpen(h.item.id)}
              >
                <Avatar kind={h.item.kind} size={36} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span className="row-title">{h.item.title}</span>
                  <span className="row-sub">{kindShort(h.item.kind)}</span>
                </span>
                <Icon name="right" size={16} />
              </button>
            ))}
          </div>
        )}

        <div className="dock-row">
          <label className="dock-search">
            <Icon name="search" size={20} strokeWidth={2} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('mshell.searchAll')}
              aria-label={t('nav.search')}
            />
          </label>
          <button type="button" className="dock-add" aria-label={t('mshell.quickAdd')} onClick={onAdd}>
            <Icon name="plus" size={24} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </>
  );
}

/** One-line subtitle for the compact mobile rows. */
function mobileSubtitle(it: Item): string {
  if (isVaultKind(it.kind)) {
    return it.kind === 'login' && it.username ? it.username : mask(it.secret, 0);
  }
  if (it.kind === 'task' && it.todos.length) {
    return tr('mshell.todosDone', {
      done: it.todos.filter((todo) => todo.done).length,
      total: it.todos.length,
    });
  }
  if (it.kind === 'link') return it.url.replace(/^https?:\/\//, '');
  return it.body.split('\n')[0].slice(0, 60) || tr('mshell.noContent');
}

/* ── Vault list ──────────────────────────────────────────────────────── */

function VaultList({
  onOpen,
  onBack,
  onLock,
  vaultSeconds,
}: {
  onOpen: (id: string) => void;
  onBack: () => void;
  onLock: () => void;
  vaultSeconds: number;
}) {
  const { t } = useT();
  const { items, removeItems } = useStore();
  const { copy, notify } = useSession();
  const health = useHealth(items);
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [showIssues, setShowIssues] = useState(false);
  const selection = useSelection();

  const vaultItems = useMemo(() => items.filter((i) => isVaultKind(i.kind)), [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vaultItems
      .filter((i) => (filter === 'all' ? true : i.kind === filter))
      .filter((i) => (q ? i.title.toLowerCase().includes(q) || i.username.toLowerCase().includes(q) : true))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [vaultItems, filter, query]);

  const deleteSelected = () => {
    const ids = [...selection.ids];
    if (!ids.length) return;
    if (!window.confirm(t('shell.confirmDelete', { n: count(ids.length) }))) return;
    removeItems(ids);
    selection.cancel();
    notify(t('shell.deleted', { n: count(ids.length) }));
  };

  const issues = [...health.weak, ...health.reused];

  return (
    <>
      <div className="mobile-scroll" style={{ paddingBottom: 40 }}>
        {selection.active ? (
          <SelectionBar
            selected={selection.count}
            total={visible.length}
            onToggleAll={() => selection.toggleAll(visible.map((i) => i.id))}
            onDelete={deleteSelected}
            onCancel={selection.cancel}
          />
        ) : (
          <div className="mobile-appbar">
            <button type="button" className="round-btn" aria-label={t('shell.back')} onClick={onBack}>
              <Icon name="left" size={20} strokeWidth={2} />
            </button>
            <h1>{t('mshell.vault')}</h1>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 12px',
                borderRadius: 999,
                background: 'rgba(198,243,107,0.12)',
                color: 'var(--accent)',
                font: "500 13px var(--mono)",
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Icon name="lock" size={14} strokeWidth={2} />
              {mmss(vaultSeconds)}
            </span>
            {visible.length > 0 && (
              <button
                type="button"
                className="round-btn is-flat"
                aria-label={t('mshell.selectMany')}
                onClick={selection.start}
              >
                <Icon name="check" size={19} strokeWidth={2} />
              </button>
            )}
            <button type="button" className="round-btn is-flat" aria-label={t('vault.lockNow')} onClick={onLock}>
              <Icon name="unlock" size={19} />
            </button>
          </div>
        )}

        <label className="dock-search" style={{ height: 48, borderRadius: 14 }}>
          <Icon name="search" size={18} strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('mshell.searchVault')}
            aria-label={t('mshell.searchVault')}
          />
        </label>

        <div className="hscroll">
          <Chip dot="var(--accent)" active={filter === 'all'} onClick={() => setFilter('all')}>
            {t('nav.all')}
          </Chip>
          {(['login', 'secret', 'person'] as const).map((k) => (
            <Chip key={k} dot={KIND[k].color} active={filter === k} onClick={() => setFilter(k)}>
              {kindShort(k)}
            </Chip>
          ))}
        </div>

        {issues.length > 0 && (
          <button
            type="button"
            className="warn-banner"
            style={{ textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setShowIssues((v) => !v)}
          >
            <Icon name="warn" size={20} style={{ color: 'var(--danger)' }} />
            <span style={{ flex: 1 }}>
              {t('vault.bannerWeak', { n: count(health.weak.length) })},{' '}
              {t('vault.bannerReused', { n: count(health.reused.length) })}
            </span>
            <span className="warn-action">{showIssues ? t('vault.hide') : t('vault.view')}</span>
          </button>
        )}

        {showIssues && (
          <div className="task-card">
            {issues.map((it) => (
              <div key={it.id} className="task-row" onClick={() => onOpen(it.id)} role="button" tabIndex={0}>
                <span
                  className="health-icon"
                  style={{ background: 'var(--k-task-bg)', color: 'var(--danger)' }}
                >
                  <Icon name="warn" size={14} strokeWidth={2.2} />
                </span>
                <span className="task-main">
                  <span className="task-title">{it.title}</span>
                  <span className="task-sub">
                    {health.flagOf.get(it.id)?.type === 'reused'
                      ? t('mshell.reusedHint')
                      : t('mshell.weakHint')}
                  </span>
                </span>
                <Icon name="right" size={16} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visible.map((it) => {
            const checked = selection.has(it.id);
            return (
              <div
                key={it.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: selection.active
                    ? '28px 44px minmax(0, 1fr)'
                    : '44px minmax(0, 1fr) 44px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--divider)',
                }}
              >
                {selection.active && <Check checked={checked} />}                <button
                  type="button"
                  className="round-btn"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    background: KIND[it.kind].bg,
                    color: KIND[it.kind].color,
                    fontFamily: 'var(--mono)',
                    fontSize: 16,
                    fontWeight: 800,
                  }}
                  aria-label={it.title}
                  onClick={() => (selection.active ? selection.toggle(it.id) : onOpen(it.id))}
                >
                  {initial(it.title)}
                </button>
                <button
                  type="button"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    minWidth: 0,
                    textAlign: 'left',
                    color: 'var(--text)',
                  }}
                  onClick={() => (selection.active ? selection.toggle(it.id) : onOpen(it.id))}
                >
                  <span className="row-title">{it.title}</span>
                  <span className="row-sub">{mobileSubtitle(it)}</span>
                </button>
                {!selection.active && (
                  <button
                    type="button"
                    className="round-btn is-flat"
                    style={{ width: 44, height: 44, borderRadius: 13 }}
                    aria-label={t(it.kind === 'login' ? 'mshell.copyPasswordOf' : 'mshell.copyValueOf', {
                      title: it.title,
                    })}
                    onClick={() => copy(it.secret, t('mshell.copied', { title: it.title }))}
                  >
                    <Icon name="copy" size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {visible.length === 0 && (
          <Empty icon="lock" title={t('list.emptyTitle')} hint={t('mshell.emptyHint')} />
        )}
      </div>
    </>
  );
}

/* ── Reminders ───────────────────────────────────────────────────────── */

function Reminders({ onOpen, onBack }: { onOpen: (id: string) => void; onBack: () => void }) {
  const { t } = useT();
  const { items, updateItem } = useStore();
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const now = Date.now();
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const out: { late: Item[]; today: Item[]; soon: Item[] } = { late: [], today: [], soon: [] };
    for (const it of items) {
      if (!it.remindAt) continue;
      const done = it.todos.length > 0 && it.todos.every((todo) => todo.done);
      if (done && !showDone) continue;
      const diff = Math.round(
        (startOfDay(new Date(it.remindAt)) - startOfDay(new Date(now))) / 86_400_000,
      );
      out[diff < 0 ? 'late' : diff === 0 ? 'today' : 'soon'].push(it);
    }
    for (const k of ['late', 'today', 'soon'] as const) {
      out[k].sort((a, b) => (a.remindAt ?? '').localeCompare(b.remindAt ?? ''));
    }
    return out;
  }, [items, showDone]);

  const tone = {
    late: { bg: 'var(--k-task-bg)', fg: 'var(--danger)', label: t('rem.late') },
    today: { bg: 'rgba(198,243,107,0.14)', fg: 'var(--accent)', label: t('list.today') },
    soon: { bg: 'var(--surface-2)', fg: 'var(--text-dim)', label: t('rem.soon') },
  } as const;

  return (
    <div className="mobile-scroll" style={{ paddingBottom: 40 }}>
      <div className="mobile-appbar">
        <button type="button" className="round-btn" aria-label={t('shell.back')} onClick={onBack}>
          <Icon name="left" size={20} strokeWidth={2} />
        </button>
        <h1>{t('nav.reminders')}</h1>
        <button
          type="button"
          className="round-btn is-flat"
          aria-label={t('mshell.addTask')}
          onClick={() => setShowDone((v) => !v)}
        >
          <Icon name={showDone ? 'eyeoff' : 'eye'} size={19} />
        </button>
      </div>

      <span className="mobile-date">{longDate()}</span>

      <RemindersWeek items={items} />

      {(['late', 'today', 'soon'] as const).map((b) =>
        groups[b].length === 0 ? null : (
          <div className="task-group" key={b}>
            <div className="task-group-head" style={{ color: tone[b].fg }}>
              {tone[b].label}
              <span>{count(groups[b].length)}</span>
            </div>
            <div className="task-card">
              {groups[b].map((it) => {
                const done = it.todos.length > 0 && it.todos.every((todo) => todo.done);
                return (
                  <div
                    key={it.id}
                    className={`task-row${done ? ' is-done' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(it.id)}
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      aria-label={t('rem.markDone', { title: it.title })}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        const next = !done;
                        updateItem(it.id, {
                          todos: it.todos.length
                            ? it.todos.map((todo) => ({ ...todo, done: next }))
                            : [{ id: crypto.randomUUID(), text: it.title, done: next }],
                        });
                      }}
                    />
                    <span className="task-main">
                      <span className="task-title">{it.title}</span>
                      <span className="task-sub">
                        {it.todos.length
                          ? t('rem.subtasks', {
                              done: it.todos.filter((todo) => todo.done).length,
                              total: it.todos.length,
                            })
                          : isVaultKind(it.kind)
                            ? t('rem.inVault')
                            : it.body.split('\n')[0].slice(0, 50) || t('rem.noDesc')}
                      </span>
                    </span>
                    <span className="task-when" style={{ background: tone[b].bg, color: tone[b].fg }}>
                      {done ? t('mshell.done') : timeShort(it.remindAt!)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      )}

      {groups.late.length + groups.today.length + groups.soon.length === 0 && (
        <Empty icon="check" title={t('rem.emptyTitle')} hint={t('mshell.allDoneHint')} />
      )}
    </div>
  );
}

function timeShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ── Security & backup ──────────────────────────────────────────────── */

function Security({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { settings, updateSettings, items, exportBackup, importBackup, removeSeedItems } = useStore();
  const { notify } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const seedCount = items.filter(isSeedItem).length;

  const download = () => {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ngan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify(t('set.downloaded'));
  };

  return (
    <div className="mobile-scroll" style={{ paddingBottom: 40 }}>
      <div className="mobile-appbar">
        <button type="button" className="round-btn" aria-label={t('shell.back')} onClick={onBack}>
          <Icon name="left" size={20} strokeWidth={2} />
        </button>
        <h1 style={{ fontSize: 24 }}>{t('mshell.securityTitle')}</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '48px minmax(0, 1fr)',
          gap: 14,
          alignItems: 'center',
          padding: 18,
          borderRadius: 20,
          background: 'var(--text)',
          color: 'var(--bg)',
        }}
      >
        <span
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="shield" size={24} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{t('set.protected')}</span>
          <span style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.45 }}>
            {t('mshell.protectedSub', { n: count(items.length) })}
          </span>
        </span>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="section-label">{t('mshell.unlock')}</div>
        <div className="settings-card">
          <MobileToggle
            icon="face"
            title={t('mshell.faceId')}
            on={settings.biometric}
            onChange={(on) => updateSettings({ biometric: on })}
          />
          <MobileToggle
            icon="eyeoff"
            title={t('set.hideOnBlur')}
            on={settings.hideOnBlur}
            onChange={(on) => updateSettings({ hideOnBlur: on })}
          />
          <MobileToggle
            icon="copy"
            title={t('set.clipboard')}
            sub={t('mshell.clipboardSub', { n: settings.clipboardClearSeconds })}
            on={settings.clipboardClearSeconds > 0}
            onChange={(on) => updateSettings({ clipboardClearSeconds: on ? 30 : 0 })}
          />
          <MobileToggle
            icon="clock"
            title={t('mshell.autoLock')}
            sub={t('mshell.autoLockSub', { n: settings.autoLockMinutes })}
            on={settings.autoLockMinutes > 0}
            onChange={(on) => updateSettings({ autoLockMinutes: on ? 5 : 0 })}
          />
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="section-label">{t('mshell.syncRestore')}</div>
        <div className="settings-card">
          <MobileLink
            icon="devices"
            title={t('mshell.trustedDevices')}
            value="2"
            onClick={() => notify(t('set.syncOn'))}
          />
          <MobileLink
            icon="download"
            title={t('set.download')}
            value={t('set.downloadBtn')}
            onClick={download}
          />
          <MobileLink
            icon="upload"
            title={t('set.import')}
            value={t('list.select')}
            onClick={() => fileRef.current?.click()}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                await importBackup(await f.text());
                notify(t('set.imported'));
              } catch (err) {
                notify(err instanceof Error ? err.message : t('set.invalidFile'), 'warn');
              }
            }}
          />
          <MobileLink
            icon="sun"
            title={t('set.theme')}
            value={settings.theme === 'dark' ? t('set.dark') : t('set.light')}
            onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          />
          {seedCount > 0 && (
            <MobileLink
              icon="trash"
              title={t('set.seed')}
              value={count(seedCount)}
              onClick={() => {
                if (window.confirm(t('set.seedConfirm', { n: count(seedCount) }))) {
                  removeSeedItems();
                  notify(t('set.seedDone', { n: count(seedCount) }));
                }
              }}
            />
          )}
        </div>
      </section>

      <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-dim)' }}>
        {t('mshell.footer', { app: t('app.name') })}
      </p>
    </div>
  );
}

function MobileToggle({
  icon,
  title,
  sub,
  on,
  onChange,
}: {
  icon: IconName;
  title: string;
  sub?: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <span className="settings-icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="settings-main">
        <span className="settings-title">{title}</span>
        {sub && <span className="settings-sub">{sub}</span>}
      </span>
      <button
        type="button"
        className={`switch${on ? ' is-on' : ''}`}
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={() => onChange(!on)}
      >
        <span />
      </button>
    </div>
  );
}

function MobileLink({
  icon,
  title,
  value,
  onClick,
}: {
  icon: IconName;
  title: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="settings-row"
      style={{ border: 0, background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer' }}
      onClick={onClick}
    >
      <span className="settings-icon">
        <Icon name={icon} size={17} />
      </span>
      <span className="settings-main">
        <span className="settings-title">{title}</span>
      </span>
      <span className="settings-value">
        {value}
        <Icon name="right" size={16} />
      </span>
    </button>
  );
}

/* ── Search ─────────────────────────────────────────────────────────── */

function MobileSearch({ onOpen, onClose }: { onOpen: (id: string) => void; onClose: () => void }) {
  const { t } = useT();
  const { items, folders } = useStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hits = useMemo(() => search(items, folders, query).slice(0, 40), [items, folders, query]);

  return (
    <div className="mobile-scroll" style={{ paddingBottom: 40 }}>
      <div className="mobile-appbar">
        <button type="button" className="round-btn" aria-label={t('mshell.closeSearch')} onClick={onClose}>
          <Icon name="left" size={20} strokeWidth={2} />
        </button>
        <label className="dock-search" style={{ height: 48, borderRadius: 14 }}>
          <Icon name="search" size={18} strokeWidth={2} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('mshell.searchAll')}
            aria-label={t('nav.search')}
          />
        </label>
      </div>

      <div className="hscroll">
        {KIND_ORDER.map((k) => (
          <Chip
            key={k}
            dot={KIND[k].color}
            onClick={() => setQuery((q) => `${q}${q && !q.endsWith(' ') ? ' ' : ''}loại:${k} `)}
          >
            {kindShort(k)}
          </Chip>
        ))}
      </div>

      {query.trim() === '' ? (
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-dim)' }}>
          {t('mshell.hintTry')} <span className="mono">loại:khoá</span>,{' '}
          <span className="mono">#devops</span> {t('mshell.hintOr')}{' '}
          <span className="mono">ngăn:Công việc</span>. {t('mshell.hintSecrets')}
        </p>
      ) : hits.length === 0 ? (
        <Empty
          icon="search"
          title={t('search.noResults', { query })}
          hint={t('mshell.notFoundHint')}
        />
      ) : (
        <div className="mobile-list">
          {hits.map((h) => (
            <button
              key={h.item.id}
              type="button"
              className="mobile-row"
              onClick={() => onOpen(h.item.id)}
            >
              <Avatar kind={h.item.kind} size={40} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="row-title">
                  {h.match ? (
                    <>
                      {h.item.title.slice(0, h.match.start)}
                      <mark>{h.item.title.slice(h.match.start, h.match.end)}</mark>
                      {h.item.title.slice(h.match.end)}
                    </>
                  ) : (
                    h.item.title
                  )}
                </span>
                <span className="row-sub">
                  {isVaultKind(h.item.kind) ? (
                    <>
                      <Icon name="lock" size={11} strokeWidth={2} /> {t('mshell.vaultTitleOnly')}
                    </>
                  ) : (
                    mobileSubtitle(h.item)
                  )}
                </span>
              </span>
              <span className="row-time">{timeAgo(h.item.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "04:52" */
function mmss(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
