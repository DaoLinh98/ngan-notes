import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Button, IconButton, Modal, StrengthMeter } from '../components/ui';
import { KIND, KIND_ORDER } from '../lib/kind';
import { strength } from '../lib/crypto';
import { isVaultKind, type Folder, type Kind, type Todo } from '../lib/types';
import { useStore } from '../lib/store';
import { useSession } from '../lib/session';
import { useIsMobile } from '../lib/useMedia';
import { tr, useT, type TKey } from '../lib/i18n';

/**
 * The create flow, shared by both shells: pick a kind, then fill in that
 * kind's own form. The two steps are deliberate — a login needs a username
 * and a password, a task needs sub-tasks and a due time, and one generic
 * "content" box cannot ask for either.
 *
 * The clipboard is read once on open only to *suggest* a kind; the user still
 * picks. Nothing is saved until the form is submitted.
 */

/**
 * The kinds the clipboard heuristic can produce. Notes and tasks have no
 * shape to recognise, so they are never guessed — only picked.
 */
type GuessableKind = 'login' | 'secret' | 'person' | 'link';

/** Cheap heuristics, deliberately conservative: a wrong guess is worse than none. */
function guessKind(text: string): GuessableKind | null {
  const t = text.trim();
  if (!t) return null;
  if (/^(sk|pk|rk|ghp|xox[baprs])[-_]/i.test(t) || /^[A-Z0-9]{20,}$/.test(t)) return 'secret';
  if (/^https?:\/\//i.test(t)) return 'link';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'login';
  if (/\b\d{9,12}\b/.test(t)) return 'person';
  return null;
}

const HINTS: Record<GuessableKind, { title: TKey; body: TKey }> = {
  secret: { title: 'create.hint.secret.title', body: 'create.hint.secret.body' },
  login: { title: 'create.hint.login.title', body: 'create.hint.login.body' },
  person: { title: 'create.hint.person.title', body: 'create.hint.person.body' },
  link: { title: 'create.hint.link.title', body: 'create.hint.link.body' },
};

/** The field a suggested value belongs in. */
function suggestPatch(kind: GuessableKind, text: string): Partial<Form> {
  if (kind === 'login') return { username: text };
  if (kind === 'link') return { url: text };
  return { secret: text };
}

interface Form {
  title: string;
  body: string;
  username: string;
  secret: string;
  totp: string;
  url: string;
  secureNote: string;
  folderId: string | null;
  todos: Todo[];
  remindAt: string | null;
}

const EMPTY: Form = {
  title: '',
  body: '',
  username: '',
  secret: '',
  totp: '',
  url: '',
  secureNote: '',
  folderId: null,
  todos: [],
  remindAt: null,
};

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → the local `YYYY-MM-DDTHH:mm` a datetime-local input wants. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

/** A title is required by the store, so fall back to whatever the kind has. */
function fallbackTitle(kind: Kind, f: Form): string {
  if (f.title.trim()) return f.title.trim();
  if (kind === 'login' && f.username.trim()) return f.username.trim();
  if (kind === 'link' && f.url.trim()) return f.url.trim().replace(/^https?:\/\//, '');
  const first = f.body.trim().split('\n')[0];
  if (first) return first.slice(0, 60);
  return tr('create.newItem');
}

export function CreateItem({
  onClose,
  onCreated,
  initialFolderId = null,
}: {
  onClose: () => void;
  onCreated: (id: string, kind: Kind) => void;
  /** Pre-selects a folder — the desktop list creates into the open folder. */
  initialFolderId?: string | null;
}) {
  const { addItem, folders } = useStore();
  const { notify } = useSession();
  const isMobile = useIsMobile();
  const { t } = useT();

  const [kind, setKind] = useState<Kind | null>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY, folderId: initialFolderId });
  const [labelsText, setLabelsText] = useState('');
  const [suggestion, setSuggestion] = useState<{ kind: GuessableKind; text: string } | null>(null);
  const [error, setError] = useState<TKey | null>(null);

  // Read the clipboard once, on open, and let the guess stand as a suggestion
  // until the user picks something else.
  useEffect(() => {
    navigator.clipboard
      ?.readText()
      .then((text) => {
        const clip = (text ?? '').trim();
        if (!clip || clip.length > 400) return;
        const guess = guessKind(clip);
        if (guess) setSuggestion({ kind: guess, text: clip });
      })
      .catch(() => undefined);
  }, []);

  const patch = (p: Partial<Form>) => {
    setError(null);
    setForm((f) => ({ ...f, ...p }));
  };

  const pick = (k: Kind) => {
    if (suggestion?.kind === k) {
      const clip = suggestion.text;
      patch({
        ...suggestPatch(k, clip),
        title: clip.length > 60 ? `${clip.slice(0, 57)}…` : clip,
      });
    }
    setKind(k);
  };

  const save = () => {
    if (!kind) return;
    if (kind === 'link' && !form.url.trim()) {
      setError('create.errLinkUrl');
      return;
    }
    if ((kind === 'login' || kind === 'secret') && !form.secret.trim()) {
      setError('create.errSecret');
      return;
    }
    if (kind === 'person' && !form.secret.trim() && !form.body.trim()) {
      setError('create.errPerson');
      return;
    }
    const labels = labelsText
      .split(/[,\n]/)
      .map((l) => l.trim().replace(/^#/, ''))
      .filter(Boolean);

    const it = addItem({
      kind,
      title: fallbackTitle(kind, form),
      folderId: form.folderId,
      labels,
      body: kind === 'login' || kind === 'secret' ? '' : form.body,
      username: kind === 'login' ? form.username : '',
      secret: isVaultKind(kind) ? form.secret : '',
      totp: kind === 'login' ? form.totp : '',
      secureNote: kind === 'login' || kind === 'secret' ? form.secureNote : '',
      url: kind === 'login' || kind === 'secret' || kind === 'link' ? form.url : '',
      todos: kind === 'task' ? form.todos : [],
      remindAt: kind === 'task' ? form.remindAt : null,
    });
    notify(isVaultKind(kind) ? t('create.savedVault') : t('create.saved', { app: t('app.name') }));
    onCreated(it.id, kind);
  };

  return (
    <Modal
      onClose={onClose}
      label={kind ? t('create.addKind', { kind: t(`kind.${kind}.name`) }) : t('create.title')}
      width={560}
      align={isMobile ? 'bottom' : 'center'}
    >
      <div className="create" style={{ maxHeight: '88vh', padding: '18px 20px 20px' }}>
        <div className="create-head">
          {kind ? (
            <button
              type="button"
              className="round-btn is-flat"
              style={{ width: 36, height: 36 }}
              aria-label={t('create.otherKind')}
              onClick={() => setKind(null)}
            >
              <Icon name="left" size={18} strokeWidth={2} />
            </button>
          ) : null}
          <h1>{kind ? t(`kind.${kind}.name`) : t('create.title')}</h1>
          <button
            type="button"
            className="round-btn is-flat"
            style={{ width: 36, height: 36 }}
            aria-label={t('create.close')}
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {kind === null ? (
          <KindPicker suggestion={suggestion} onPick={pick} />
        ) : (
          <>
            <div className="create-body">
              <ItemFields
                kind={kind}
                form={form}
                patch={patch}
                labelsText={labelsText}
                setLabelsText={setLabelsText}
                folders={folders}
              />
              {error && <p className="error-text">{t(error)}</p>}
            </div>

            <div className="create-actions">
              <Button size="lg" icon="close" onClick={onClose}>
                {t('cred.cancel')}
              </Button>
              <Button variant="primary" size="lg" icon="check" onClick={save}>
                {isVaultKind(kind) ? t('create.saveVault') : t('cred.save')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Step 1: pick a kind ─────────────────────────────────────────────── */

function KindPicker({
  suggestion,
  onPick,
}: {
  suggestion: { kind: GuessableKind; text: string } | null;
  onPick: (k: Kind) => void;
}) {
  const { t } = useT();
  return (
    <div className="create-body">
      <p className="gate-sub" style={{ margin: 0 }}>
        {t('create.prompt')}
      </p>

      {suggestion && (
        <div className="hint-card">
          <span className="hint-icon">
            <Icon
              name={
                suggestion.kind === 'link'
                  ? 'link'
                  : suggestion.kind === 'person'
                    ? 'person'
                    : 'shield'
              }
              size={18}
            />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="hint-title">{t(HINTS[suggestion.kind].title)}</span>
            <span className="hint-body">
              {t(HINTS[suggestion.kind].body, {
                kind: t(`kind.${suggestion.kind}.name`),
                app: t('app.name'),
              })}
            </span>
          </span>
        </div>
      )}

      <div className="kind-pick">
        {KIND_ORDER.map((k) => {
          const meta = KIND[k];
          const suggested = suggestion?.kind === k;
          return (
            <button
              key={k}
              type="button"
              className={`kind-pick-row${suggested ? ' is-suggested' : ''}`}
              style={suggested ? { color: meta.color } : undefined}
              onClick={() => onPick(k)}
            >
              <span className="kind-pick-icon" style={{ background: meta.bg, color: meta.color }}>
                <Icon name={meta.icon} size={20} />
              </span>
              <span className="kind-pick-text">
                <span className="kind-pick-name" style={{ color: 'var(--text)' }}>
                  {t(`kind.${k}.name`)}
                </span>
                <span className="kind-pick-blurb">{t(`kind.${k}.blurb`)}</span>
              </span>
              {suggested ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: meta.color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('create.suggested')}
                </span>
              ) : (
                <Icon name="right" size={16} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 2: the kind's own form ─────────────────────────────────────── */

function ItemFields({
  kind,
  form,
  patch,
  labelsText,
  setLabelsText,
  folders,
}: {
  kind: Kind;
  form: Form;
  patch: (p: Partial<Form>) => void;
  labelsText: string;
  setLabelsText: (v: string) => void;
  folders: Folder[];
}) {
  const { t } = useT();
  const [reveal, setReveal] = useState(false);
  const s = strength(form.secret);

  return (
    <>
      <div className="form-row">
        <label className="gate-label" htmlFor="c-title">
          {t('create.name')}
        </label>
        <input
          id="c-title"
          className="input"
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={t('create.namePh')}
          autoFocus
        />
      </div>

      {kind === 'login' && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-user">
            {t('cred.username')}
          </label>
          <input
            id="c-user"
            className="input"
            value={form.username}
            onChange={(e) => patch({ username: e.target.value })}
            placeholder={t('create.usernamePh')}
          />
        </div>
      )}

      {isVaultKind(kind) && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-secret">
            {kind === 'login'
              ? t('cred.password')
              : kind === 'person'
                ? t('create.personValue')
                : t('cred.secretKey')}
          </label>
          <div className="input-wrap">
            <input
              id="c-secret"
              type={reveal ? 'text' : 'password'}
              value={form.secret}
              onChange={(e) => patch({ secret: e.target.value })}
              placeholder={kind === 'person' ? t('create.personPh') : t('create.secretPh')}
              autoComplete="off"
            />
            <IconButton
              name={reveal ? 'eyeoff' : 'eye'}
              label={reveal ? t('create.hideValue') : t('create.showValue')}
              onClick={() => setReveal((v) => !v)}
              size={40}
            />
          </div>
          {/* A passport number has no "strength" — only real secrets are scored. */}
          {form.secret && kind !== 'person' && <StrengthMeter score={s.score} label={s.label} />}
        </div>
      )}

      {kind === 'login' && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-totp">
            {t('cred.totpKey')}
          </label>
          <input
            id="c-totp"
            className="input is-mono"
            value={form.totp}
            onChange={(e) => patch({ totp: e.target.value })}
            placeholder={t('cred.totpEmpty')}
          />
        </div>
      )}

      {(kind === 'login' || kind === 'secret') && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-url">
            {t('cred.website')}
          </label>
          <input
            id="c-url"
            className="input"
            value={form.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://…"
          />
        </div>
      )}

      {kind === 'link' && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-link">
            {t('create.url')}
          </label>
          <input
            id="c-link"
            className="input"
            value={form.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://…"
          />
        </div>
      )}

      {kind === 'note' && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-body">
            {t('item.content')}
          </label>
          <textarea
            id="c-body"
            className="textarea"
            style={{ minHeight: 160 }}
            value={form.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder={t('item.bodyPlaceholder')}
          />
        </div>
      )}

      {kind === 'task' && (
        <>
          <div className="form-row">
            <label className="gate-label" htmlFor="c-task">
              {t('create.description')}
            </label>
            <textarea
              id="c-task"
              className="textarea"
              style={{ minHeight: 100 }}
              value={form.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder={t('create.taskPh')}
            />
          </div>

          <div className="form-row">
            <span className="gate-label">{t('create.subtasks')}</span>
            <TodoEditor todos={form.todos} onChange={(todos) => patch({ todos })} />
          </div>

          <div className="form-row">
            <label className="gate-label" htmlFor="c-remind">
              {t('create.remindAt')}
            </label>
            <div className="remind-row">
              <input
                id="c-remind"
                type="datetime-local"
                className="input"
                value={toLocalInput(form.remindAt)}
                onChange={(e) => patch({ remindAt: fromLocalInput(e.target.value) })}
              />
              {form.remindAt && (
                <IconButton
                  name="close"
                  label={t('create.clearReminder')}
                  size={40}
                  onClick={() => patch({ remindAt: null })}
                />
              )}
            </div>
          </div>
        </>
      )}

      {kind === 'person' && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-pnote">
            {t('create.note')}
          </label>
          <textarea
            id="c-pnote"
            className="textarea"
            style={{ minHeight: 100 }}
            value={form.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder={t('create.personNotePh')}
          />
        </div>
      )}

      {kind === 'link' && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-lnote">
            {t('create.note')}
          </label>
          <textarea
            id="c-lnote"
            className="textarea"
            style={{ minHeight: 100 }}
            value={form.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder={t('create.linkNotePh')}
          />
        </div>
      )}

      {(kind === 'login' || kind === 'secret') && (
        <div className="form-row">
          <label className="gate-label" htmlFor="c-snote">
            {t('cred.secureNote')}
          </label>
          <textarea
            id="c-snote"
            className="textarea"
            style={{ minHeight: 90 }}
            value={form.secureNote}
            onChange={(e) => patch({ secureNote: e.target.value })}
            placeholder={t('create.secureNotePh')}
          />
        </div>
      )}

      <div className="form-row">
        <label className="gate-label" htmlFor="c-labels">
          {t('nav.labels')}
        </label>
        <input
          id="c-labels"
          className="input"
          value={labelsText}
          onChange={(e) => setLabelsText(e.target.value)}
          placeholder={t('create.labelsPh')}
        />
      </div>

      <div className="form-row">
        <span className="gate-label">{t('nav.folders')}</span>
        <div className="chip-row">
          <button
            type="button"
            className={`chip${form.folderId === null ? ' is-active' : ''}`}
            onClick={() => patch({ folderId: null })}
          >
            {t('create.unfiled')}
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip${form.folderId === f.id ? ' is-active' : ''}`}
              onClick={() => patch({ folderId: f.id })}
            >
              <span className="chip-dot" style={{ background: f.color }} />
              {f.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** Sub-task editor for `task` items — same rows the detail pane renders. */
function TodoEditor({ todos, onChange }: { todos: Todo[]; onChange: (next: Todo[]) => void }) {
  const { t } = useT();
  const [text, setText] = useState('');

  const add = () => {
    const value = text.trim();
    if (!value) return;
    onChange([...todos, { id: crypto.randomUUID(), text: value, done: false }]);
    setText('');
  };

  return (
    <div className="checklist">
      {todos.map((todo) => (
        <div key={todo.id} className={`check-row${todo.done ? ' is-done' : ''}`}>
          <input
            type="checkbox"
            checked={todo.done}
            aria-label={todo.text}
            onChange={() =>
              onChange(todos.map((x) => (x.id === todo.id ? { ...x, done: !x.done } : x)))
            }
          />
          <span style={{ flex: 1 }}>{todo.text}</span>
          <IconButton
            name="close"
            label={t('item.removeTodo')}
            size={28}
            onClick={() => onChange(todos.filter((x) => x.id !== todo.id))}
          />
        </div>
      ))}
      <div className="task-add" style={{ height: 44 }}>
        <Icon name="plus" size={16} />
        <input
          value={text}
          placeholder={t('item.addTodo')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>
    </div>
  );
}
