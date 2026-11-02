import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Button, Chip, Empty, IconButton, SectionLabel } from '../components/ui';
import { ItemRow, VaultRow } from '../components/ItemRow';
import { SelectionBar } from '../components/SelectionBar';
import { KIND, KIND_ORDER } from '../lib/kind';
import { count } from '../lib/format';
import { useSelection } from '../lib/useSelection';
import { isVaultKind, type Item, type Kind } from '../lib/types';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { useT } from '../lib/i18n';
import { ItemDetail } from './ItemDetail';
import { VaultPane, useHealth } from './VaultPane';
import { RemindersPane } from './RemindersPane';
import { SettingsPane } from './SettingsPane';
import { SearchPalette } from './SearchPalette';
import { CreateItem } from './CreateItem';

export type View =
  | { kind: 'all' }
  | { kind: 'starred' }
  | { kind: 'recent' }
  | { kind: 'reminders' }
  | { kind: 'vault' }
  | { kind: 'settings' }
  | { kind: 'folder'; id: string }
  | { kind: 'label'; label: string };

export const isVaultView = (v: View) => v.kind === 'vault';

/** Sidebar counts, recomputed from the live item list. */
function useCounts(items: Item[]) {
  return useMemo(() => {
    const byKind = Object.fromEntries(KIND_ORDER.map((k) => [k, 0])) as Record<Kind, number>;
    let starred = 0;
    let pinned = 0;
    let reminders = 0;
    const byFolder = new Map<string, number>();
    const labels = new Map<string, number>();

    for (const it of items) {
      byKind[it.kind]++;
      if (it.starred) starred++;
      if (it.pinned) pinned++;
      // A reminder with no sub-tasks is still open; one with sub-tasks is
      // only done when every sub-task is. Matches RemindersPane.
      if (it.remindAt && !(it.todos.length > 0 && it.todos.every((t) => t.done))) reminders++;
      if (it.folderId) byFolder.set(it.folderId, (byFolder.get(it.folderId) ?? 0) + 1);
      for (const l of it.labels) labels.set(l, (labels.get(l) ?? 0) + 1);
    }
    return { byKind, starred, pinned, reminders, byFolder, labels, total: items.length };
  }, [items]);
}

export function DesktopShell({
  view,
  setView,
  selectedId,
  setSelectedId,
  onLock,
}: {
  view: View;
  setView: (v: View) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onLock: () => void;
}) {
  const { items, folders, settings, updateSettings, unlockedByBiometric, removeItems } = useStore();
  const { vaultSeconds, notify } = useSession();
  const { t, lang, setLang } = useT();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [kindFilter, setKindFilter] = useState<Kind | 'all'>('all');
  const selection = useSelection();
  const counts = useCounts(items);
  const health = useHealth(items);

  // "Tạo mới" opens the create flow: pick a kind, then fill in that kind's
  // form. Nothing is written until the form is submitted.
  const openCreate = () => setCreating(true);

  // Every sidebar navigation goes through here. The kind filter resets to
  // "Tất cả" unless the destination asks for one, so a section that holds a
  // single item never opens empty because of a filter left over from the
  // section before it.
  const go = (v: View, kind: Kind | 'all' = 'all') => {
    setView(v);
    setKindFilter(kind);
  };

  const folderName = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  );

  // Items for the current view, before the kind filter narrows them further.
  const scoped = useMemo(() => {
    const byRecent = (a: Item, b: Item) => b.updatedAt.localeCompare(a.updatedAt);
    switch (view.kind) {
      case 'all':
        return [...items].sort(byRecent);
      case 'starred':
        return items.filter((i) => i.starred).sort(byRecent);
      case 'recent':
        return [...items].sort(byRecent).slice(0, 20);
      case 'vault':
        return items.filter((i) => isVaultKind(i.kind)).sort(byRecent);
      case 'folder':
        return items.filter((i) => i.folderId === view.id).sort(byRecent);
      case 'label':
        return items.filter((i) => i.labels.includes(view.label)).sort(byRecent);
      default:
        return [];
    }
  }, [items, view]);

  const visible = useMemo(
    () => (kindFilter === 'all' ? scoped : scoped.filter((i) => i.kind === kindFilter)),
    [scoped, kindFilter],
  );

  const pinned = visible.filter((i) => i.pinned);
  const rest = visible.filter((i) => !i.pinned);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  // Leaving the list (or switching to a view with no list) drops selection
  // mode, so the bar never floats over an unrelated screen. Depends on the
  // stable callback, not the hook's object, which is new on every render.
  const listView = view.kind !== 'reminders' && view.kind !== 'settings';
  const cancelSelection = selection.cancel;
  useEffect(() => {
    if (!listView) cancelSelection();
  }, [listView, cancelSelection]);

  const deleteSelected = () => {
    const ids = [...selection.ids];
    if (!ids.length) return;
    if (!window.confirm(t('shell.confirmDelete', { n: count(ids.length) }))) return;
    removeItems(ids);
    if (selectedId && selection.ids.has(selectedId)) setSelectedId(null);
    selection.cancel();
    notify(t('shell.deleted', { n: count(ids.length) }));
  };

  // Keep the reading pane valid: if the selection fell out of the current
  // view (folder change, filter, deletion) pick the first visible item.
  useEffect(() => {
    if (view.kind === 'reminders' || view.kind === 'settings' || view.kind === 'vault') return;
    if (selected && visible.some((i) => i.id === selected.id)) return;
    setSelectedId(visible[0]?.id ?? null);
  }, [view.kind, visible, selected, setSelectedId]);

  // ⌘K / Ctrl-K opens the palette from anywhere; ⌘N starts a new item.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCreating(true);
      }
      if (meta && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        onLock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLock]);

  const title = useMemo(() => {
    switch (view.kind) {
      case 'all':
        return t('nav.all');
      case 'starred':
        return t('nav.starred');
      case 'recent':
        return t('nav.recent');
      case 'reminders':
        return t('nav.tasksReminders');
      case 'vault':
        return t('nav.vault');
      case 'settings':
        return t('nav.settings');
      case 'folder':
        return folderName.get(view.id) ?? t('nav.folders');
      case 'label':
        return `#${view.label}`;
    }
  }, [view, folderName, t]);

  const vaultLocked = false; // Reaching this shell means the vault is open.

  return (
    <div className="app">
      <nav className="app-nav" aria-label={t('nav.aria')}>
        <div className="brand">
          <LogoMark />
          <span className="brand-name">{t('app.name')}</span>
          <span className="sync-badge">
            <span className="sync-dot" />
            {t('nav.synced')}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button variant="primary" full icon="plus" onClick={openCreate}>
            {t('nav.create')}
          </Button>
          <button type="button" className="search-bar" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={16} />
            <span style={{ flex: 1, textAlign: 'left' }}>{t('nav.search')}</span>
            <span className="kbd">⌘K</span>
          </button>
        </div>

        <div className="nav-stack">
          <NavItem
            icon="grid"
            name={t('nav.all')}
            countText={count(counts.total)}
            active={view.kind === 'all'}
            onClick={() => go({ kind: 'all' })}
          />
          <NavItem
            icon="star"
            name={t('nav.starred')}
            countText={counts.starred ? count(counts.starred) : ''}
            active={view.kind === 'starred'}
            onClick={() => go({ kind: 'starred' })}
          />
          <NavItem
            icon="clock"
            name={t('nav.recent')}
            active={view.kind === 'recent'}
            onClick={() => go({ kind: 'recent' })}
          />
          <NavItem
            icon="bell"
            name={t('nav.reminders')}
            countText={counts.reminders ? count(counts.reminders) : ''}
            active={view.kind === 'reminders'}
            onClick={() => go({ kind: 'reminders' })}
          />
        </div>

        <div className="nav-stack">
          <div className="nav-head">
            <span className="nav-title">{t('nav.vault')}</span>
            <span className="vault-state">
              <Icon name="lock" size={12} strokeWidth={2} />
              {t('nav.open')}
            </span>
          </div>
          <NavItem
            icon="login"
            name={t('kind.login.label')}
            countText={count(counts.byKind.login)}
            tile={{ color: KIND.login.color, bg: KIND.login.bg }}
            active={view.kind === 'vault' && kindFilter === 'login'}
            onClick={() => go({ kind: 'vault' }, 'login')}
          />
          <NavItem
            icon="code"
            name={t('kind.secret.label')}
            countText={count(counts.byKind.secret)}
            tile={{ color: KIND.secret.color, bg: KIND.secret.bg }}
            active={view.kind === 'vault' && kindFilter === 'secret'}
            onClick={() => go({ kind: 'vault' }, 'secret')}
          />
          <NavItem
            icon="person"
            name={t('kind.person.label')}
            countText={count(counts.byKind.person)}
            tile={{ color: KIND.person.color, bg: KIND.person.bg }}
            active={view.kind === 'vault' && kindFilter === 'person'}
            onClick={() => go({ kind: 'vault' }, 'person')}
          />
        </div>

        <div className="nav-stack is-scroll">
          <div className="nav-head">
            <span className="nav-title">{t('nav.folders')}</span>
          </div>
          {folders.map((f) => (
            <NavItem
              key={f.id}
              icon="folder"
              iconColor={f.color}
              name={f.name}
              countText={count(counts.byFolder.get(f.id) ?? 0)}
              active={view.kind === 'folder' && view.id === f.id}
              onClick={() => go({ kind: 'folder', id: f.id })}
            />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel style={{ padding: '0 10px' }}>{t('nav.labels')}</SectionLabel>
          <div className="label-cloud">
            {[...counts.labels.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([label]) => (
                <button
                  key={label}
                  type="button"
                  className="label-pill"
                  onClick={() => go({ kind: 'label', label })}
                >
                  #{label}
                </button>
              ))}
          </div>
        </div>

        <div className="user-card">
          <span className="user-avatar">AS</span>
          <button
            type="button"
            className="icon-btn lang-btn"
            style={{ width: 32, height: 32 }}
            aria-label={t('lang.switch')}
            title={t('lang.switch')}
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
          >
            {lang.toUpperCase()}
          </button>
          <IconButton
            name={settings.theme === 'dark' ? 'sun' : 'moon'}
            label={settings.theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}
            size={32}
            onClick={() =>
              updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
          />
          <IconButton
            name="sliders"
            label={t('nav.settings')}
            size={32}
            active={view.kind === 'settings'}
            onClick={() => go({ kind: 'settings' })}
          />
        </div>
      </nav>

      <section className="app-list" aria-label={t('list.aria')}>
        <div className="list-head">
          <div className="list-title-row">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <h1 className="list-title">{title}</h1>
              <span className="list-sub">
                {view.kind === 'vault'
                  ? t('list.subVault', { n: count(scoped.length) })
                  : view.kind === 'reminders'
                    ? t('list.subReminders', { n: count(counts.reminders) })
                    : t('list.subDefault', { n: count(visible.length) })}
              </span>
            </div>
            {view.kind === 'vault' && (
              <Button size="sm" icon="lock" onClick={onLock}>
                {t('list.lockNow')}
              </Button>
            )}
            {listView && visible.length > 0 && !selection.active && (
              <Button size="sm" icon="check" onClick={selection.start}>
                {t('list.select')}
              </Button>
            )}
          </div>

          {selection.active && (
            <SelectionBar
              selected={selection.count}
              total={visible.length}
              onToggleAll={() => selection.toggleAll(visible.map((i) => i.id))}
              onDelete={deleteSelected}
              onCancel={selection.cancel}
            />
          )}

          {view.kind === 'vault' && (
            <div className="vault-open-banner">
              <Icon name="shield" size={16} />
              <span style={{ flex: 1 }}>
                {unlockedByBiometric
                  ? t('list.openBio')
                  : t('list.openPwd')}
              </span>
              <span className="timer">{mmss(vaultSeconds)}</span>
            </div>
          )}

          {view.kind !== 'reminders' && view.kind !== 'settings' && (
            <div className="chip-row">
              <Chip
                dot="var(--accent)"
                active={kindFilter === 'all'}
                onClick={() => setKindFilter('all')}
              >
                {t('nav.all')}
              </Chip>
              {KIND_ORDER.map((k) => (
                <Chip
                  key={k}
                  dot={KIND[k].color}
                  active={kindFilter === k}
                  onClick={() => setKindFilter(k)}
                >
                  {t(`kind.${k}.short`)}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <div className="list-scroll">
          {view.kind === 'reminders' ? (
            <RemindersPane onOpen={setSelectedId} />
          ) : visible.length === 0 ? (
            <Empty
              icon="search"
              title={t('list.emptyTitle')}
              hint={t('list.emptyHint')}
            />
          ) : view.kind === 'vault' ? (
            // The vault list shows the initial-avatar rows from the design,
            // with a health flag where a password is weak or reused.
            visible.map((it) => (
              <VaultRow
                key={it.id}
                item={it}
                selected={it.id === selectedId}
                flag={health.flagOf.get(it.id)}
                onOpen={() => setSelectedId(it.id)}
                selecting={selection.active}
                checked={selection.has(it.id)}
                onToggle={() => selection.toggle(it.id)}
              />
            ))
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <div className="list-group-head">
                    <Icon name="pin" size={12} strokeWidth={2} />
                    {t('list.pinned')}
                  </div>
                  {pinned.map((it) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      folderName={it.folderId ? folderName.get(it.folderId) : undefined}
                      selected={it.id === selectedId}
                      locked={vaultLocked}
                      onOpen={() => setSelectedId(it.id)}
                      selecting={selection.active}
                      checked={selection.has(it.id)}
                      onToggle={() => selection.toggle(it.id)}
                    />
                  ))}
                  <div className="list-group-head">{t('list.today')}</div>
                </>
              )}
              {rest.map((it) => (
                <ItemRow
                  key={it.id}
                  item={it}
                  folderName={it.folderId ? folderName.get(it.folderId) : undefined}
                  selected={it.id === selectedId}
                  locked={vaultLocked}
                  onOpen={() => setSelectedId(it.id)}
                  selecting={selection.active}
                  checked={selection.has(it.id)}
                  onToggle={() => selection.toggle(it.id)}
                />
              ))}
            </>
          )}
        </div>
      </section>

      <main className="app-main">
        {view.kind === 'settings' ? (
          <SettingsPane />
        ) : view.kind === 'vault' ? (
          <VaultPane
            items={scoped}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            kindFilter={kindFilter}
            onLock={onLock}
            folderName={folderName}
          />
        ) : selected ? (
          <ItemDetail
            item={selected}
            folderName={selected.folderId ? folderName.get(selected.folderId) : undefined}
            onOpenVault={() => go({ kind: 'vault' })}
            onDeleted={() => setSelectedId(null)}
            onNavigate={setSelectedId}
          />
        ) : (
          <Empty
            icon="note"
            title={t('main.emptyTitle')}
            hint={t('main.emptyHint')}
          />
        )}
      </main>

      {paletteOpen && (
        <SearchPalette
          onClose={() => setPaletteOpen(false)}
          onOpen={(id) => {
            const it = items.find((i) => i.id === id);
            if (it && isVaultKind(it.kind)) go({ kind: 'vault' });
            else go({ kind: 'all' });
            setSelectedId(id);
          }}
        />
      )}

      {creating && (
        <CreateItem
          initialFolderId={view.kind === 'folder' ? view.id : null}
          onClose={() => setCreating(false)}
          onCreated={(id, kind) => {
            setCreating(false);
            // Land on the new item. A credential always belongs in the vault;
            // anything else only needs the view changed when the current one
            // cannot show it at all (vault, reminders, settings).
            if (isVaultKind(kind)) go({ kind: 'vault' });
            else if (view.kind === 'vault' || view.kind === 'reminders' || view.kind === 'settings')
              go({ kind: 'all' });
            else setKindFilter('all');
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────── */

function LogoMark() {
  return (
    <svg width={30} height={30} viewBox="0 0 56 56" aria-hidden="true">
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
        strokeWidth="3"
      />
      <rect x="14" y="31" width="28" height="9" rx="3" fill="var(--accent)" />
    </svg>
  );
}

function NavItem({
  icon,
  name,
  countText,
  active,
  onClick,
  tile,
  iconColor,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  name: string;
  countText?: string;
  active?: boolean;
  onClick: () => void;
  tile?: { color: string; bg: string };
  iconColor?: string;
}) {
  return (
    <button
      type="button"
      className={`nav-item${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      {tile ? (
        <span className="nav-tile" style={{ background: tile.bg, color: tile.color }}>
          <Icon name={icon} size={13} strokeWidth={2} />
        </span>
      ) : (
        <Icon name={icon} size={17} style={iconColor ? { color: iconColor } : undefined} />
      )}
      <span className="nav-name">{name}</span>
      {countText ? <span className="nav-count">{countText}</span> : null}
    </button>
  );
}

/** "04:52" */
function mmss(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
