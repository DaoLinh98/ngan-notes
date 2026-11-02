import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Empty, StrengthMeter } from '../components/ui';
import { TotpRing } from '../components/TotpRing';
import { KIND } from '../lib/kind';
import { daysSince, initial, reminderLabel, timeAgo } from '../lib/format';
import { strength, totp, totpRemaining } from '../lib/crypto';
import { isVaultKind, type Item } from '../lib/types';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { useT } from '../lib/i18n';

/**
 * The phone's item screen. Credentials get the field-card treatment with a
 * fixed action bar at the bottom, because one-handed copying is the whole
 * point; everything else falls back to a readable article.
 */
export function MobileDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { items, folders, updateItem, removeItem } = useStore();
  const { revealed, toggleReveal, copy, notify } = useSession();
  const { t } = useT();
  const item = items.find((i) => i.id === id) ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Item | null>(item);

  useEffect(() => {
    setDraft(item);
    setEditing(false);
  }, [item]);

  const folderName = useMemo(
    () => (item?.folderId ? folders.find((f) => f.id === item.folderId)?.name : undefined),
    [item, folders],
  );

  if (!item || !draft) {
    return (
      <div className="mobile-scroll">
        <Empty icon="search" title={t('mdetail.goneTitle')} hint={t('mdetail.goneHint')} />
      </div>
    );
  }

  const meta = KIND[item.kind];
  const kindLabel = t(`kind.${item.kind}.name`);
  const isCredential = isVaultKind(item.kind);
  const isRevealed = revealed.has(item.id);
  const s = strength(item.secret);

  const save = () => {
    updateItem(item.id, {
      title: draft.title.trim() || t('item.untitled'),
      body: draft.body,
      username: draft.username,
      secret: draft.secret,
      url: draft.url,
      secureNote: draft.secureNote,
    });
    setEditing(false);
    notify(t('mdetail.saved'));
  };

  const askDelete = () => {
    if (window.confirm(t('item.confirmDelete', { title: item.title }))) {
      removeItem(item.id);
      notify(t('item.deleted'));
      onBack();
    }
  };

  return (
    <div className="mobile" style={{ height: '100%' }}>
      <div className="mobile-scroll" style={{ paddingBottom: isCredential ? 130 : 40 }}>
        <div className="mobile-appbar">
          <button type="button" className="round-btn" aria-label={t('mdetail.back')} onClick={onBack}>
            <Icon name="left" size={20} strokeWidth={2} />
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="round-btn"
            aria-label={item.starred ? t('item.unstar') : t('item.star')}
            style={{ color: item.starred ? 'var(--k-login)' : 'var(--text)' }}
            onClick={() => updateItem(item.id, { starred: !item.starred })}
          >
            <Icon name="star" size={19} filled={item.starred} />
          </button>
          <button
            type="button"
            className="round-btn"
            aria-label={editing ? t('cred.save') : t('cred.edit')}
            onClick={() => (editing ? save() : setEditing(true))}
          >
            <Icon name={editing ? 'check' : 'edit'} size={19} />
          </button>
          <button
            type="button"
            className="round-btn"
            aria-label={t('mdetail.delete')}
            style={{ color: 'var(--danger)' }}
            onClick={askDelete}
          >
            <Icon name="trash" size={19} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: 17,
              background: meta.bg,
              color: meta.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 800,
              fontFamily: 'var(--mono)',
            }}
          >
            {initial(item.title)}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            {editing ? (
              <input
                className="input"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                aria-label={t('cred.title')}
                style={{ height: 44, fontSize: 18, fontWeight: 700 }}
              />
            ) : (
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {item.title}
              </h1>
            )}
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {kindLabel}
              {folderName ? ` · ${folderName}` : ''}
            </span>
          </div>
        </div>

        {isCredential ? (
          <div className="settings-card">
            {item.kind !== 'secret' && (
              <MobileField
                label={t('cred.username')}
                value={editing ? draft.username : item.username}
                editing={editing}
                onChange={(v) => setDraft({ ...draft, username: v })}
                onCopy={() => copy(item.username, t('cred.copiedUsername'))}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 8px 14px 16px', borderBottom: '1px solid var(--divider)' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span className="field-label">
                  {item.kind === 'secret' ? t('cred.secretKey') : t('cred.password')}
                </span>
                {editing ? (
                  <input
                    className="input is-mono"
                    value={draft.secret}
                    onChange={(e) => setDraft({ ...draft, secret: e.target.value })}
                    aria-label={t('mdetail.value')}
                  />
                ) : (
                  <span
                    className="mono"
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      letterSpacing: isRevealed ? '0.04em' : '0.14em',
                      wordBreak: 'break-all',
                    }}
                  >
                    {isRevealed ? item.secret : '•'.repeat(Math.min(20, Math.max(8, item.secret.length)))}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="round-btn is-flat"
                style={{ width: 44, height: 44, borderRadius: 12 }}
                aria-label={isRevealed ? t('mdetail.hideValue') : t('mdetail.showValue')}
                onClick={() => toggleReveal(item.id)}
              >
                <Icon name={isRevealed ? 'eyeoff' : 'eye'} size={19} />
              </button>
            </div>

            {item.totp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 8px 14px 16px', borderBottom: '1px solid var(--divider)' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="field-label">{t('mdetail.totp')}</span>
                  <MobileTotp seed={item.totp} />
                </div>
                <button
                  type="button"
                  className="round-btn is-flat"
                  style={{ width: 44, height: 44, borderRadius: 12 }}
                  aria-label={t('cred.copyTotp')}
                  onClick={async () => copy(await totp(item.totp), t('cred.copiedTotp'))}
                >
                  <Icon name="copy" size={19} />
                </button>
              </div>
            )}

            {(item.url || editing) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 8px 14px 16px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                  <span className="field-label">{t('cred.website')}</span>
                  {editing ? (
                    <input
                      className="input"
                      value={draft.url}
                      onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                      aria-label={t('cred.website')}
                    />
                  ) : (
                    <span style={{ fontSize: 16, color: 'var(--k-link)', wordBreak: 'break-all' }}>
                      {item.url}
                    </span>
                  )}
                </div>
                {item.url && !editing && (
                  <button
                    type="button"
                    className="round-btn is-flat"
                    style={{ width: 44, height: 44, borderRadius: 12 }}
                    aria-label={t('mdetail.openWebsite')}
                    onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                  >
                    <Icon name="ext" size={19} />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {editing ? (
              <textarea
                className="textarea"
                style={{ minHeight: 180, fontSize: 16 }}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                aria-label={t('item.content')}
              />
            ) : (
              <div className="article-body" style={{ fontSize: 16 }}>
                {item.body || <span style={{ color: 'var(--text-dim)' }}>{t('item.noBody')}</span>}
              </div>
            )}

            {item.kind === 'link' && item.url && (
              <a
                className="linked"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <Icon name="link" size={20} style={{ color: 'var(--k-link)' }} />
                <span className="linked-main">
                  <span className="linked-title">{item.url.replace(/^https?:\/\//, '')}</span>
                  <span className="linked-sub">{t('item.openNewTab')}</span>
                </span>
                <Icon name="ext" size={18} />
              </a>
            )}

            {item.todos.length > 0 && (
              <div className="checklist">
                {item.todos.map((todo) => (
                  <label key={todo.id} className={`check-row${todo.done ? ' is-done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() =>
                        updateItem(item.id, {
                          todos: item.todos.map((x) => (x.id === todo.id ? { ...x, done: !x.done } : x)),
                        })
                      }
                    />
                    <span style={{ flex: 1 }}>{todo.text}</span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        {isCredential && !editing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
            <div style={{ flex: '0 0 96px' }}>
              <StrengthMeter score={s.score} label="" />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              {t('mdetail.strengthAge', { label: s.label, n: daysSince(item.updatedAt) })}
            </span>
          </div>
        )}

        {item.remindAt && (
          <div className="reminder-badge" style={{ alignSelf: 'flex-start' }}>
            <Icon name="bell" size={14} />
            {t('item.remind', { when: reminderLabel(item.remindAt) })}
          </div>
        )}

        {item.labels.length > 0 && (
          <div className="chip-row">
            {item.labels.map((l) => (
              <span className="label-pill" key={l}>
                #{l}
              </span>
            ))}
          </div>
        )}

        {editing && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setDraft(item);
                setEditing(false);
              }}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <span>{t('cred.cancel')}</span>
            </button>
          </div>
        )}

        <span style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
          {t('mdetail.editedE2e', { time: timeAgo(item.updatedAt) })}
        </span>
      </div>

      {isCredential && !editing && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '16px 20px 30px',
            background: 'var(--bg)',
            borderTop: '1px solid var(--divider)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              style={{ height: 56, justifyContent: 'center' }}
              onClick={() => copy(item.username || item.secret, t('mdetail.copied'))}
            >
              <Icon name="copy" size={20} />
              <span>{item.kind === 'login' ? t('cred.username') : t('ui.copy')}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              style={{ height: 56, justifyContent: 'center' }}
              onClick={() => copy(item.secret, t('cred.copiedPassword'))}
            >
              <Icon name="copy" size={20} />
              <span>{t('cred.copyPassword')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileField({
  label,
  value,
  editing,
  onChange,
  onCopy,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  onCopy: () => void;
}) {
  const { t } = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 8px 14px 16px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span className="field-label">{label}</span>
        {editing ? (
          <input className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        ) : (
          <span style={{ fontSize: 16, wordBreak: 'break-all' }}>{value || '—'}</span>
        )}
      </div>
      {!editing && value && (
        <button
          type="button"
          className="round-btn is-flat"
          style={{ width: 44, height: 44, borderRadius: 12 }}
          aria-label={t('mdetail.copyField', { label })}
          onClick={onCopy}
        >
          <Icon name="copy" size={19} />
        </button>
      )}
    </div>
  );
}

/** Live code with the same countdown ring as the desktop pane. */
function MobileTotp({ seed }: { seed: string }) {
  const [code, setCode] = useState('••• •••');
  const [left, setLeft] = useState(30);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const c = await totp(seed);
      if (!alive) return;
      setCode(`${c.slice(0, 3)} ${c.slice(3)}`);
      setLeft(totpRemaining());
    };
    void run();
    const t = window.setInterval(() => void run(), 1000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [seed]);

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="mono" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '0.12em' }}>
        {code}
      </span>
      <TotpRing remaining={left} total={30} />
      <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{left}s</span>
    </span>
  );
}
