import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar, Chip, Modal } from '../components/ui';
import { KIND, KIND_ORDER, KIND_SHORT } from '../lib/kind';
import { count, reminderLabel, timeAgo } from '../lib/format';
import { search, type Hit } from '../lib/search';
import { isVaultKind, type Kind } from '../lib/types';
import { useStore } from '../lib/store';
import { useT } from '../lib/i18n';

/**
 * ⌘K. One field, everything findable: free text plus `loại:`, `ngăn:`, `#nhãn`
 * and `@quan trọng`. Secrets never appear in the results — a vault row shows
 * its title and a lock, nothing more.
 */
export function SearchPalette({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const { items, folders } = useStore();
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => search(items, folders, query).slice(0, 60), [items, folders, query]);
  const active = hits[Math.min(cursor, Math.max(0, hits.length - 1))];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The cursor must not survive a query that shrank the list under it.
  useEffect(() => {
    setCursor(0);
  }, [query]);

  const open = (hit: Hit | undefined) => {
    if (!hit) return;
    onOpen(hit.item.id);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      open(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Modal onClose={onClose} label={t('nav.search')} width="80vw" height="80vh">
      <div className="palette">
        <div className="palette-input">
          <Icon name="search" size={22} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('search.placeholder')}
            aria-label={t('search.queryAria')}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              className="icon-btn"
              aria-label={t('search.clear')}
              onClick={() => setQuery('')}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        <div className="palette-chips">
          {KIND_ORDER.map((k) => (
            <Chip
              key={k}
              dot={KIND[k].color}
              onClick={() => setQuery((q) => `${q}${q && !q.endsWith(' ') ? ' ' : ''}loại:${k} `)}
            >
              {KIND_SHORT[k]}
            </Chip>
          ))}
          <Chip
            dot="var(--k-login)"
            onClick={() => setQuery((q) => `${q}${q && !q.endsWith(' ') ? ' ' : ''}@quan trọng `)}
          >
            {t('nav.starred')}
          </Chip>
        </div>

        <div className="palette-rows">
          {query.trim() === '' ? (
            <RecentRows items={items} onOpen={(id) => { onOpen(id); onClose(); }} />
          ) : hits.length === 0 ? (
            <div className="palette-head" style={{ padding: '24px 12px', textAlign: 'center' }}>
              {t('search.noResults', { query })}
            </div>
          ) : (
            <>
              <div className="palette-head">{t('search.results', { n: count(hits.length) })}</div>
              {hits.map((hit, i) => (
                <PaletteRow
                  key={hit.item.id}
                  hit={hit}
                  active={hit === active}
                  onHover={() => setCursor(i)}
                  onOpen={() => open(hit)}
                />
              ))}
            </>
          )}
        </div>

        <div className="palette-foot">
          <span className="hint">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span>
            {t('search.hintSelect')}
          </span>
          <span className="hint">
            <span className="kbd">↵</span>
            {t('search.hintOpen')}
          </span>
          <span className="hint">
            <span className="kbd">esc</span>
            {t('search.hintClose')}
          </span>
          <span className="hint tail">
            <span className="kbd">loại:</span>
            <span className="kbd">#nhãn</span>
            <span className="kbd">ngăn:</span>
          </span>
        </div>
      </div>
    </Modal>
  );
}

/** An empty field shows what was touched last, so ⌘K is useful immediately. */
function RecentRows({ items, onOpen }: { items: Hit['item'][]; onOpen: (id: string) => void }) {
  const recent = useMemo(
    () => [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 9),
    [items],
  );
  const { t } = useT();
  if (!recent.length) return null;
  return (
    <>
      <div className="palette-head">{t('nav.recent')}</div>
      {recent.map((it) => (
        <button key={it.id} type="button" className="palette-row" onClick={() => onOpen(it.id)}>
          <Avatar kind={it.kind} size={38} />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {it.title}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {KIND[it.kind].label}
              {it.remindAt ? ` · ${t('search.remindAt', { when: reminderLabel(it.remindAt) })}` : ''}
            </span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{timeAgo(it.updatedAt)}</span>
        </button>
      ))}
    </>
  );
}

function PaletteRow({
  hit,
  active,
  onHover,
  onOpen,
}: {
  hit: Hit;
  active: boolean;
  onHover: () => void;
  onOpen: () => void;
}) {
  const { item, match } = hit;
  const locked = isVaultKind(item.kind);
  const { t } = useT();

  return (
    <button
      type="button"
      className={`palette-row${active ? ' is-active' : ''}`}
      onMouseEnter={onHover}
      onClick={onOpen}
    >
      <Avatar kind={item.kind} size={38} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {match ? (
            <>
              {item.title.slice(0, match.start)}
              <mark>{item.title.slice(match.start, match.end)}</mark>
              {item.title.slice(match.end)}
            </>
          ) : (
            item.title
          )}
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-dim)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {locked ? (
            <>
              <Icon name="lock" size={11} strokeWidth={2} /> {t('search.vaultRow')}
            </>
          ) : (
            KIND[item.kind].label
          )}
        </span>
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-dim)',
        }}
      >
        {item.pinned && <Icon name="pin" size={13} />}
        {item.starred && <Icon name="star" size={13} filled />}
        {timeAgo(item.updatedAt)}
      </span>
    </button>
  );
}

/** Re-exported so the mobile search screen can share the kind chips. */
export function KindChips({
  value,
  onChange,
}: {
  value: Kind | 'all';
  onChange: (k: Kind | 'all') => void;
}) {
  const { t } = useT();
  return (
    <div className="chip-row">
      <Chip dot="var(--accent)" active={value === 'all'} onClick={() => onChange('all')}>
        {t('nav.all')}
      </Chip>
      {KIND_ORDER.map((k) => (
        <Chip key={k} dot={KIND[k].color} active={value === k} onClick={() => onChange(k)}>
          {KIND_SHORT[k]}
        </Chip>
      ))}
    </div>
  );
}
