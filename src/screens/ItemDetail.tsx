import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import {
  Avatar,
  Button,
  Field,
  IconButton,
  KindBadge,
  LabelPill,
  SecretField,
  StrengthMeter,
} from '../components/ui';
import { KIND } from '../lib/kind';
import { daysSince, reminderLabel, timeAgo, wordCount } from '../lib/format';
import { strength, totp, totpRemaining } from '../lib/crypto';
import { isVaultKind, type Item } from '../lib/types';
import { useStore } from '../lib/store';
import { useT, type TKey } from '../lib/i18n';
import { useSession } from '../lib/session';
import { TotpRing } from '../components/TotpRing';

/**
 * The reading pane. Notes and tasks edit in place; credentials are read-only
 * cards with per-field copy, because a password field that accepts typing is a
 * password field that can be mistyped.
 */
export function ItemDetail({
  item,
  folderName,
  onOpenVault,
  onDeleted,
  onNavigate,
}: {
  item: Item;
  folderName?: string;
  onOpenVault: () => void;
  onDeleted: () => void;
  onNavigate: (id: string | null) => void;
}) {
  const { updateItem, removeItem, items } = useStore();
  const { revealed, toggleReveal, copy, notify } = useSession();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Switching items abandons an in-progress edit rather than carrying it over.
  useEffect(() => {
    setDraft(item);
    setEditing(false);
  }, [item.id, item]);

  const isCredential = isVaultKind(item.kind);
  const isRevealed = revealed.has(item.id);
  const { t, lang } = useT();
  // `lang` is a dependency because the strength label is translated.
  const s = useMemo(() => strength(item.secret), [item.secret, lang]);

  const save = () => {
    updateItem(item.id, {
      title: draft.title.trim() || t('item.untitled'),
      body: draft.body,
      username: draft.username,
      secret: draft.secret,
      url: draft.url,
      secureNote: draft.secureNote,
      labels: draft.labels,
      folderId: draft.folderId,
      todos: draft.todos,
      remindAt: draft.remindAt,
    });
    setEditing(false);
  };

  const toggleTodo = (todoId: string) => {
    updateItem(item.id, {
      todos: item.todos.map((t) => (t.id === todoId ? { ...t, done: !t.done } : t)),
    });
  };

  const askDelete = () => {
    if (window.confirm(t('item.confirmDelete', { title: item.title }))) {
      removeItem(item.id);
      onDeleted();
      notify(t('item.deleted'));
    }
  };

  // Only credentials that live in the vault get the vault chrome.
  if (isCredential) {
    return (
      <CredentialDetail
        item={item}
        folderName={folderName}
        revealed={isRevealed}
        onToggleReveal={() => toggleReveal(item.id)}
        onCopy={(text, label) => copy(text, label)}
        strengthScore={s}
        editing={editing}
        draft={draft}
        setDraft={setDraft}
        onEdit={() => setEditing(true)}
        onSave={save}
        onCancel={() => {
          setDraft(item);
          setEditing(false);
        }}
        onDelete={askDelete}
        onOpenVault={onOpenVault}
      />
    );
  }

  return (
    <div className="app-main" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="main-bar">
        <span className="crumbs">
          <Icon name="folder" size={15} />
          {folderName ?? t('cred.unfiled')}
          <Icon name="right" size={13} strokeWidth={2} />
          <strong>{item.title}</strong>
        </span>
        <IconButton
          name="pin"
          label={item.pinned ? t('item.unpin') : t('item.pin')}
          active={item.pinned}
          color={item.pinned ? 'var(--accent)' : undefined}
          onClick={() => updateItem(item.id, { pinned: !item.pinned })}
        />
        <IconButton
          name="star"
          label={item.starred ? t('item.unstar') : t('item.star')}
          active={item.starred}
          color={item.starred ? 'var(--k-login)' : undefined}
          filled={item.starred}
          onClick={() => updateItem(item.id, { starred: !item.starred })}
        />
        <IconButton
          name={editing ? 'check' : 'edit'}
          label={editing ? t('cred.save') : t('cred.edit')}
          active={editing}
          onClick={() => (editing ? save() : setEditing(true))}
        />
        <IconButton name="trash" label={t('cred.delete')} onClick={askDelete} />
      </div>

      <article className="article">
        <div className="badge-row">
          <KindBadge kind={item.kind} />
          {item.remindAt && (
            <span className="reminder-badge">
              <Icon name="bell" size={14} />
              {t('item.remind', { when: reminderLabel(item.remindAt) })}
            </span>
          )}
          {item.labels.map((l) => (
            <LabelPill key={l} label={l} />
          ))}
        </div>

        {editing ? (
          <input
            className="input"
            style={{ fontSize: 28, fontWeight: 700, height: 56 }}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            autoFocus
            aria-label={t('cred.title')}
          />
        ) : (
          <h2
            className="article-title"
            ref={titleRef}
            contentEditable={false}
            onDoubleClick={() => setEditing(true)}
          >
            {item.title}
          </h2>
        )}

        <div className="article-byline">
          {t('item.byline', { time: timeAgo(item.updatedAt), n: wordCount(item.body) })}
        </div>

        {editing ? (
          <textarea
            className="textarea"
            style={{ minHeight: 220, fontSize: 16 }}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder={t('item.bodyPlaceholder')}
            aria-label={t('item.content')}
          />
        ) : (
          <div
            className="article-body"
            onDoubleClick={() => setEditing(true)}
            role="textbox"
            aria-readonly="true"
            tabIndex={0}
          >
            {item.body || <span style={{ color: 'var(--text-dim)' }}>{t('item.noBody')}</span>}
          </div>
        )}

        {(item.todos.length > 0 || (editing && item.kind === 'task')) && (
          <Checklist
            todos={item.todos}
            editing={editing}
            onToggle={toggleTodo}
            onAdd={(text) =>
              updateItem(item.id, {
                todos: [...item.todos, { id: crypto.randomUUID(), text, done: false }],
              })
            }
            onRemove={(todoId) =>
              updateItem(item.id, { todos: item.todos.filter((t) => t.id !== todoId) })
            }
          />
        )}

        {item.kind === 'link' && item.url && (
          <div className="linked">
            <Avatar kind="link" size={44} />
            <span className="linked-main">
              <span className="linked-title">{item.url.replace(/^https?:\/\//, '')}</span>
              <span className="linked-sub">{t('item.openNewTab')}</span>
            </span>
            <Button
              size="sm"
              icon="ext"
              onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
            >
              {t('item.open')}
            </Button>
          </div>
        )}

        <RelatedVault items={items} current={item} onNavigate={onNavigate} onOpenVault={onOpenVault} />

        <div className="encrypted-note">
          <Icon name="shield" size={14} />
          {t('item.e2e')}
        </div>
      </article>
    </div>
  );
}

/* ── Checklist ───────────────────────────────────────────────────────── */

function Checklist({
  todos,
  editing,
  onToggle,
  onAdd,
  onRemove,
}: {
  todos: Item['todos'];
  editing: boolean;
  onToggle: (id: string) => void;
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useT();
  const [text, setText] = useState('');
  return (
    <div className="checklist">
      {todos.map((todo) => (
        <label key={todo.id} className={`check-row${todo.done ? ' is-done' : ''}`}>
          <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
          <span style={{ flex: 1 }}>{todo.text}</span>
          {editing && (
            <IconButton name="close" label={t('item.removeTodo')} size={28} onClick={() => onRemove(todo.id)} />
          )}
        </label>
      ))}
      {editing && (
        <div className="task-add" style={{ height: 44 }}>
          <Icon name="plus" size={16} />
          <input
            value={text}
            placeholder={t('item.addTodo')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                onAdd(text.trim());
                setText('');
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Related vault entries ───────────────────────────────────────────── */

/**
 * Notes often reference a credential ("the deploy key"). Matching on the item's
 * labels surfaces those, always masked, with a link into the vault.
 */
function RelatedVault({
  items,
  current,
  onNavigate,
  onOpenVault,
}: {
  items: Item[];
  current: Item;
  onNavigate: (id: string) => void;
  onOpenVault: () => void;
}) {
  const { t } = useT();
  const related = useMemo(() => {
    if (!current.labels.length) return [];
    return items
      .filter(
        (i) =>
          i.id !== current.id &&
          isVaultKind(i.kind) &&
          i.labels.some((l) => current.labels.includes(l)),
      )
      .slice(0, 3);
  }, [items, current]);

  if (!related.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="section-label" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>
        {t('item.related')}
      </div>
      {related.map((r) => (
        <div className="linked" key={r.id}>
          <Avatar kind={r.kind} size={44} />
          <span className="linked-main">
            <span className="linked-title">{r.title}</span>
            <span className="linked-sub mono">
              {(r.kind === 'login' ? r.username : r.secret).slice(0, 4)}
              {'•'.repeat(16)}
            </span>
          </span>
          <Button
            size="sm"
            icon="lock"
            onClick={() => {
              onOpenVault();
              onNavigate(r.id);
            }}
          >
            {t('item.openVaultToView')}
          </Button>
        </div>
      ))}
    </div>
  );
}

/* ── Credential detail ───────────────────────────────────────────────── */

function CredentialDetail({
  item,
  folderName,
  revealed,
  onToggleReveal,
  onCopy,
  strengthScore,
  editing,
  draft,
  setDraft,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onOpenVault,
}: {
  item: Item;
  folderName?: string;
  revealed: boolean;
  onToggleReveal: () => void;
  onCopy: (text: string, label: string) => void;
  strengthScore: { score: number; label: string };
  editing: boolean;
  draft: Item;
  setDraft: (i: Item) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onOpenVault: () => void;
}) {
  const { updateItem } = useStore();
  const { notify } = useSession();
  const { t } = useT();
  const meta = KIND[item.kind];
  const usedDays = daysSince(item.updatedAt);
  const stale = usedDays > 90;

  if (editing) {
    return (
      <div className="detail">
        <div className="detail-main">
          <div className="detail-head">
            <span className="detail-avatar" style={{ background: meta.bg, color: meta.color }}>
              <Icon name={meta.icon} size={26} />
            </span>
            <div className="detail-titles">
              <input
                className="input"
                style={{ fontSize: 22, fontWeight: 700, height: 48 }}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                aria-label={t('cred.title')}
              />
            </div>
          </div>

          <div className="cred-card" style={{ padding: 18, gap: 14, display: 'flex', flexDirection: 'column' }}>
            <div className="form-row">
              <label className="gate-label" htmlFor="ed-title">
                {t('cred.title')}
              </label>
              <input
                id="ed-title"
                className="input"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="gate-label" htmlFor="ed-user">
                {t('cred.username')}
              </label>
              <input
                id="ed-user"
                className="input"
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="gate-label" htmlFor="ed-secret">
                {item.kind === 'secret' ? t('cred.secretKey') : t('cred.password')}
              </label>
              <input
                id="ed-secret"
                className="input is-mono"
                value={draft.secret}
                onChange={(e) => setDraft({ ...draft, secret: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="gate-label" htmlFor="ed-totp">
                {t('cred.totpKey')}
              </label>
              <input
                id="ed-totp"
                className="input is-mono"
                value={draft.totp}
                onChange={(e) => setDraft({ ...draft, totp: e.target.value })}
                placeholder={t('cred.totpEmpty')}
              />
            </div>
            <div className="form-row">
              <label className="gate-label" htmlFor="ed-url">
                {t('cred.website')}
              </label>
              <input
                id="ed-url"
                className="input"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label className="gate-label" htmlFor="ed-note">
                {t('cred.secureNote')}
              </label>
              <textarea
                id="ed-note"
                className="textarea"
                style={{ minHeight: 90 }}
                value={draft.secureNote}
                onChange={(e) => setDraft({ ...draft, secureNote: e.target.value })}
              />
            </div>
          </div>

          <div className="detail-actions">
            <Button variant="primary" icon="check" onClick={onSave}>
              {t('cred.save')}
            </Button>
            <Button onClick={onCancel}>{t('cred.cancel')}</Button>
            <Button variant="danger" icon="trash" onClick={onDelete}>
              {t('cred.delete')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detail">
      <div className="detail-main">
        <div className="detail-head">
          <span className="detail-avatar" style={{ background: meta.bg, color: meta.color }}>
            <Icon name={meta.icon} size={26} />
          </span>
          <div className="detail-titles">
            <h2>{item.title}</h2>
            <div className="detail-meta">
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 24,
                  padding: '0 8px',
                  borderRadius: 7,
                  background: meta.bg,
                  color: meta.color,
                  fontWeight: 500,
                }}
              >
                {t(`kind.${item.kind}.name` as TKey)}
              </span>
              {t('cred.editedAgo', {
                folder: folderName ?? t('cred.unfiled'),
                time: timeAgo(item.updatedAt),
              })}
            </div>
          </div>
          <Button size="sm" icon="edit" onClick={onEdit}>
            {t('cred.edit')}
          </Button>
        </div>

        <div className="cred-card">
          {item.kind !== 'secret' && (
            <Field
              label={t('cred.username')}
              value={item.username}
              onCopy={() => onCopy(item.username, t('cred.copiedUsername'))}
              copyLabel={t('cred.copyUsername')}
            />
          )}

          <div className="field is-secret">
            <div className="field-main">
              <span className="field-label">
                {item.kind === 'secret' ? t('cred.secretKey') : t('cred.password')}
                <em>{revealed ? t('cred.shown') : t('cred.hidden')}</em>
              </span>
              <SecretField
                value={item.secret}
                revealed={revealed}
                onToggle={onToggleReveal}
                onCopy={() => onCopy(item.secret, t('cred.copiedPassword'))}
                colorful
                copyLabel={t('cred.copyPassword')}
              />
              <StrengthMeter score={strengthScore.score} label={strengthScore.label} />
            </div>
          </div>

          {item.totp && (
            <div className="field">
              <div className="field-main">
                <span className="field-label">{t('cred.totp')}</span>
                <TotpRow seed={item.totp} onCopy={(code) => onCopy(code, t('cred.copiedTotp'))} />
              </div>
            </div>
          )}

          {item.url && (
            <Field
              label={t('cred.website')}
              onCopy={() => onCopy(item.url, t('cred.copiedUrl'))}
              copyLabel={t('cred.copyUrl')}
            >
              <span className="field-value" style={{ color: 'var(--k-link)' }}>
                {item.url}
              </span>
            </Field>
          )}

          <Field
            label={t('cred.secureNote')}
            onCopy={() => onCopy(item.secureNote, t('cred.copiedNote'))}
            copyLabel={t('cred.copyNote')}
          >
            <span
              className="field-value mono"
              style={{ color: 'var(--text-dim)', letterSpacing: '0.1em' }}
            >
              {item.secureNote ? '•'.repeat(Math.min(24, item.secureNote.length)) : '—'}
            </span>
          </Field>
        </div>

        <div className="detail-actions">
          <Button
            icon="wand"
            onClick={() => {
              const next = window.prompt(t('cred.newPasswordPrompt'), item.secret);
              if (next) {
                updateItem(item.id, { secret: next });
                notify(t('cred.passwordUpdated'));
              }
            }}
          >
            {t('cred.newPassword')}
          </Button>
          <Button icon="history" onClick={onOpenVault}>
            {t('cred.history')}
          </Button>
        </div>
      </div>

      <aside className="aside">
        <div className="panel">
          <div className="section-label">{t('panel.thisPassword')}</div>
          <HealthRow
            ok={strengthScore.score >= 3}
            text={t('panel.strength', { label: strengthScore.label })}
          />
          <HealthRow ok text={t('panel.unique')} />
          <HealthRow
            ok={!stale}
            text={t(stale ? 'panel.shouldChange' : 'panel.fresh', { n: usedDays })}
          />
        </div>

        <div className="panel">
          <div className="section-label">{t('panel.activity')}</div>
          <div className="activity-row">{t('panel.copiedAt', { time: timeAgo(item.updatedAt) })}</div>
          <div className="activity-row is-dim">{t('panel.viewedAt', { time: timeAgo(item.updatedAt) })}</div>
          <div className="panel-foot">{t('panel.logNote')}</div>
        </div>
      </aside>
    </div>
  );
}

function HealthRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="health-row">
      <span
        className="health-icon"
        style={
          ok
            ? { background: 'rgba(198,243,107,0.14)', color: 'var(--accent)' }
            : { background: 'var(--k-login-bg)', color: 'var(--k-login)' }
        }
      >
        <Icon name={ok ? 'check' : 'warn'} size={14} strokeWidth={2.2} />
      </span>
      <span style={{ flex: 1 }}>{text}</span>
    </div>
  );
}

/** Live 6-digit code with the countdown ring from the design. */
function TotpRow({ seed, onCopy }: { seed: string; onCopy: (code: string) => void }) {
  const { t } = useT();
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
    const timer = window.setInterval(() => void run(), 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [seed]);

  return (
    <div className="totp">
      <span className="totp-code">{code}</span>
      <TotpRing remaining={left} total={30} />
      <span className="totp-left">{t('cred.totpLeft', { n: left })}</span>
      <IconButton
        name="copy"
        label={t('cred.copyTotp')}
        size={40}
        onClick={() => onCopy(code.replace(' ', ''))}
      />
    </div>
  );
}
