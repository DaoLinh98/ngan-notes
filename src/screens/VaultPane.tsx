import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar, Button, Empty } from '../components/ui';
import { KIND, KIND_SHORT } from '../lib/kind';
import { count, daysSince, timeAgo } from '../lib/format';
import { strength } from '../lib/crypto';
import { isVaultKind, type Item, type Kind } from '../lib/types';
import { useStore } from '../lib/store';
import { useT } from '../lib/i18n';
import { ItemDetail } from './ItemDetail';

/**
 * Password health, computed from what is actually stored. Anything scored
 * below "Mạnh" counts as weak; a secret shared by two entries counts as a
 * duplicate. Both are the two things the design's banner calls out.
 */
export interface Health {
  weak: Item[];
  reused: Item[];
  stale: Item[];
  /** item id → the flag shown on its row, if any. `type` is stable across languages. */
  flagOf: Map<string, HealthFlag>;
}

export interface HealthFlag {
  type: 'weak' | 'reused' | 'stale';
  text: string;
  color: string;
}

export function useHealth(items: Item[]): Health {
  const { t } = useT();
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) {
      if (it.secret) counts.set(it.secret, (counts.get(it.secret) ?? 0) + 1);
    }

    const weak: Item[] = [];
    const reused: Item[] = [];
    const stale: Item[] = [];
    const flagOf = new Map<string, HealthFlag>();

    for (const it of items) {
      if (!isVaultKind(it.kind)) continue;
      const score = strength(it.secret).score;
      const isReused = it.secret.length > 0 && (counts.get(it.secret) ?? 0) > 1;
      if (score <= 1) {
        weak.push(it);
        flagOf.set(it.id, { type: 'weak', text: t('vault.flagWeak'), color: 'var(--danger)' });
      } else if (isReused) {
        reused.push(it);
        flagOf.set(it.id, { type: 'reused', text: t('vault.flagReused'), color: 'var(--warn)' });
      } else if (daysSince(it.updatedAt) > 90) {
        stale.push(it);
        flagOf.set(it.id, { type: 'stale', text: t('vault.flagStale'), color: 'var(--warn)' });
      }
    }
    return { weak, reused, stale, flagOf };
  }, [items, t]);
}

export function VaultPane({
  items,
  selectedId,
  setSelectedId,
  kindFilter,
  onLock,
  folderName,
}: {
  items: Item[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  kindFilter: Kind | 'all';
  onLock: () => void;
  folderName: Map<string, string>;
}) {
  const { items: all, removeItem } = useStore();
  const { t } = useT();
  const health = useHealth(all);
  const [showIssues, setShowIssues] = useState(false);

  const filtered = useMemo(
    () => (kindFilter === 'all' ? items : items.filter((i) => i.kind === kindFilter)),
    [items, kindFilter],
  );

  const selected = filtered.find((i) => i.id === selectedId) ?? null;
  const issues = [...health.weak, ...health.reused, ...health.stale];

  if (selected) {
    return (
      <ItemDetail
        item={selected}
        folderName={selected.folderId ? folderName.get(selected.folderId) : undefined}
        onOpenVault={onLock}
        onDeleted={() => setSelectedId(null)}
        onNavigate={setSelectedId}
      />
    );
  }

  return (
    <div className="detail">
      <div className="detail-main">
        {issues.length > 0 && (
          <div className="warn-banner">
            <Icon name="warn" size={20} style={{ color: 'var(--danger)' }} />
            <span style={{ flex: 1 }}>
              {health.weak.length > 0 && t('vault.bannerWeak', { n: count(health.weak.length) })}
              {health.weak.length > 0 && health.reused.length > 0 && ', '}
              {health.reused.length > 0 && t('vault.bannerReused', { n: count(health.reused.length) })}
              {health.weak.length === 0 && health.reused.length === 0 && t('vault.bannerStale')}
            </span>
            <button
              type="button"
              className="warn-action"
              onClick={() => setShowIssues((v) => !v)}
            >
              {showIssues ? t('vault.hide') : t('vault.view')}
            </button>
          </div>
        )}

        {showIssues && issues.length > 0 && (
          <div className="settings-card">
            {issues.map((it) => (
              <button
                key={it.id}
                type="button"
                className="settings-row"
                style={{ border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setSelectedId(it.id)}
              >
                <Avatar kind={it.kind} size={32} mono label={it.title[0]?.toUpperCase()} />
                <span className="settings-main">
                  <span className="settings-title">{it.title}</span>
                  <span className="settings-sub">
                    {health.flagOf.get(it.id)?.type === 'weak'
                      ? t('panel.strength', { label: strength(it.secret).label })
                      : health.flagOf.get(it.id)?.type === 'reused'
                        ? t('vault.reusedSub')
                        : t('vault.usedDays', { n: daysSince(it.updatedAt) })}
                  </span>
                </span>
                <span className="settings-value">
                  <Icon name="right" size={16} />
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="settings-card">
          <div className="panel" style={{ border: 0, background: 'transparent' }}>
            <div className="section-label">{t('vault.health')}</div>
            <div className="health-row">
              <span
                className="health-icon"
                style={{ background: 'var(--k-secret-bg)', color: 'var(--k-secret)' }}
              >
                <Icon name="lock" size={14} strokeWidth={2.2} />
              </span>
              <span style={{ flex: 1 }}>
                {t('vault.encryptedCount', { n: count(filtered.length) })}
              </span>
            </div>
            <div className="health-row">
              <span
                className="health-icon"
                style={
                  health.weak.length
                    ? { background: 'var(--k-task-bg)', color: 'var(--danger)' }
                    : { background: 'rgba(198,243,107,0.14)', color: 'var(--accent)' }
                }
              >
                <Icon
                  name={health.weak.length ? 'warn' : 'check'}
                  size={14}
                  strokeWidth={2.2}
                />
              </span>
              <span style={{ flex: 1 }}>
                {health.weak.length
                  ? t('vault.weakCount', { n: count(health.weak.length) })
                  : t('vault.noWeak')}
              </span>
            </div>
            <div className="health-row">
              <span
                className="health-icon"
                style={
                  health.reused.length
                    ? { background: 'var(--k-login-bg)', color: 'var(--warn)' }
                    : { background: 'rgba(198,243,107,0.14)', color: 'var(--accent)' }
                }
              >
                <Icon
                  name={health.reused.length ? 'warn' : 'check'}
                  size={14}
                  strokeWidth={2.2}
                />
              </span>
              <span style={{ flex: 1 }}>
                {health.reused.length
                  ? t('vault.reusedCount', { n: count(health.reused.length) })
                  : t('vault.noReused')}
              </span>
            </div>
            <div className="panel-foot">
              {t('vault.healthNote', { app: t('app.name') })}
            </div>
          </div>
        </div>

        <div className="settings-card">
          <div className="section-label" style={{ padding: '14px 14px 0' }}>
            {t('vault.recent')}
          </div>
          {[...filtered]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .slice(0, 4)
            .map((it) => (
              <button
                key={it.id}
                type="button"
                className="settings-row"
                style={{ border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setSelectedId(it.id)}
              >
                <Avatar kind={it.kind} size={32} mono label={it.title[0]?.toUpperCase()} />
                <span className="settings-main">
                  <span className="settings-title">{it.title}</span>
                  <span className="settings-sub">
                    {KIND_SHORT[it.kind]} · {timeAgo(it.updatedAt)}
                  </span>
                </span>
                <span className="settings-value">
                  <Icon name="right" size={16} />
                </span>
              </button>
            ))}
        </div>

        <div className="detail-actions">
          <Button icon="lock" onClick={onLock}>
            {t('vault.lockNow')}
          </Button>
          <Button
            icon="trash"
            variant="ghost"
            onClick={() => {
              const target = filtered.find((i) => health.weak.includes(i)) ?? filtered[0];
              if (!target) return;
              if (window.confirm(t('vault.confirmRemove', { title: target.title }))) {
                removeItem(target.id);
                setSelectedId(null);
              }
            }}
            disabled={!filtered.length}
          >
            {t('vault.cleanWeak')}
          </Button>
        </div>
      </div>

      <aside className="aside">
        <div className="panel">
          <div className="section-label">{t('vault.categories')}</div>
          {(['login', 'secret', 'person'] as const).map((k) => (
            <div className="health-row" key={k}>
              <span
                className="health-icon"
                style={{ background: KIND[k].bg, color: KIND[k].color }}
              >
                <Icon name={KIND[k].icon} size={14} strokeWidth={2.2} />
              </span>
              <span style={{ flex: 1 }}>{KIND[k].label}</span>
              <span style={{ color: 'var(--text-dim)' }}>
                {count(all.filter((i) => i.kind === k).length)}
              </span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="section-label">{t('vault.log')}</div>
          <div className="activity-row">{t('vault.logUnlocked')}</div>
          <div className="activity-row is-dim">{t('vault.logClipboard')}</div>
          <div className="panel-foot">
            {t('vault.logNote')}
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Shared empty state for the vault list column. */
export function VaultEmpty() {
  const { t } = useT();
  return (
    <Empty
      icon="lock"
      title={t('vault.emptyTitle')}
      hint={t('vault.emptyHint', { create: t('nav.create') })}
    />
  );
}
