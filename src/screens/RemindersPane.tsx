import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Button } from '../components/ui';
import { clockTime, count, reminderLabel, timeAgo } from '../lib/format';
import { isVaultKind, type Item } from '../lib/types';
import { useStore } from '../lib/store';
import { useT, type TKey } from '../lib/i18n';

/**
 * Reminders, grouped the way the design groups them: overdue first, then
 * today, then the coming week. A task with sub-tasks is only "done" when all
 * of them are, so the checkbox here writes through to the item.
 */

type Bucket = 'late' | 'today' | 'soon';

const TONE: Record<Bucket, { bg: string; fg: string }> = {
  late: { bg: 'var(--k-task-bg)', fg: 'var(--danger)' },
  today: { bg: 'rgba(198,243,107,0.14)', fg: 'var(--accent)' },
  soon: { bg: 'var(--surface-2)', fg: 'var(--text-dim)' },
};

const BUCKET_LABEL: Record<Bucket, TKey> = {
  late: 'rem.late',
  today: 'list.today',
  soon: 'rem.soon',
};

function bucketOf(item: Item, now: number): Bucket {
  if (!item.remindAt) return 'soon';
  const d = new Date(item.remindAt);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOfDay(d) - startOfDay(new Date(now))) / 86_400_000);
  if (diff < 0) return 'late';
  if (diff === 0) return 'today';
  return 'soon';
}

const isDone = (item: Item) =>
  item.todos.length > 0 ? item.todos.every((t) => t.done) : false;

export function RemindersPane({ onOpen }: { onOpen: (id: string) => void }) {
  const { items, updateItem } = useStore();
  const { t } = useT();
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => {
    const now = Date.now();
    const out: Record<Bucket, Item[]> = { late: [], today: [], soon: [] };
    for (const it of items) {
      if (!it.remindAt) continue;
      if (isDone(it) && !showDone) continue;
      out[bucketOf(it, now)].push(it);
    }
    for (const k of Object.keys(out) as Bucket[]) {
      out[k].sort((a, b) => (a.remindAt ?? '').localeCompare(b.remindAt ?? ''));
    }
    return out;
  }, [items, showDone]);

  const total = groups.late.length + groups.today.length + groups.soon.length;

  return (
    <>
      <div className="list-group-head" style={{ gap: 10 }}>
        <Icon name="bell" size={12} strokeWidth={2} />
        {t('rem.count', { n: count(total) })}
        <button
          type="button"
          className="chip"
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? t('rem.hideDone') : t('rem.showDone')}
        </button>
      </div>

      {(['late', 'today', 'soon'] as Bucket[]).map((b) =>
        groups[b].length === 0 ? null : (
          <div className="task-group" key={b} style={{ padding: '10px 12px 4px' }}>
            <div className="task-group-head" style={{ color: TONE[b].fg }}>
              {t(BUCKET_LABEL[b])}
              <span>{count(groups[b].length)}</span>
            </div>
            <div className="task-card">
              {groups[b].map((it) => (
                <div
                  key={it.id}
                  className={`task-row${isDone(it) ? ' is-done' : ''}`}
                  onClick={() => onOpen(it.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(it.id)}
                >
                  <input
                    type="checkbox"
                    checked={isDone(it)}
                    aria-label={t('rem.markDone', { title: it.title })}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      // A task with sub-tasks completes as a whole; a plain
                      // reminder just toggles its single implicit item.
                      const done = !isDone(it);
                      updateItem(it.id, {
                        todos: it.todos.length
                          ? it.todos.map((td) => ({ ...td, done }))
                          : [{ id: crypto.randomUUID(), text: it.title, done }],
                      });
                    }}
                  />
                  <span className="task-main">
                    <span className="task-title">{it.title}</span>
                    <span className="task-sub">
                      {it.todos.length
                        ? t('rem.subtasks', {
                            done: it.todos.filter((td) => td.done).length,
                            total: it.todos.length,
                          })
                        : isVaultKind(it.kind)
                          ? t('rem.inVault')
                          : it.body.split('\n')[0].slice(0, 60) || t('rem.noDesc')}
                    </span>
                  </span>
                  <span
                    className="task-when"
                    style={{ background: TONE[b].bg, color: TONE[b].fg }}
                  >
                    {reminderLabel(it.remindAt!)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ),
      )}

      {total === 0 && (
        <div className="empty">
          <span className="empty-icon">
            <Icon name="check" size={26} />
          </span>
          <p className="empty-title">{t('rem.emptyTitle')}</p>
          <p className="empty-hint">
            {t('rem.emptyHint')}
          </p>
        </div>
      )}
    </>
  );
}

/** The mobile reminders screen: a week strip plus the same three groups. */
export function RemindersWeek({ items }: { items: Item[] }) {
  const { t } = useT();
  const today = new Date();

  const week = useMemo(() => {
    const start = new Date(today);
    // Vietnamese weeks start on Monday.
    const shift = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - shift);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dayItems = items.filter(
        (it) =>
          it.remindAt &&
          new Date(it.remindAt).toDateString() === d.toDateString() &&
          !isDone(it),
      );
      return { date: d, count: dayItems.length, isToday: i === shift };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const names: TKey[] = ['rem.mon', 'rem.tue', 'rem.wed', 'rem.thu', 'rem.fri', 'rem.sat', 'rem.sun'];

  return (
    <div className="week-strip">
      {week.map((d, i) => (
        <div key={i} className={`week-day${d.isToday ? ' is-today' : ''}`}>
          <span className="wd-name">{t(names[i])}</span>
          <span className="wd-num">{d.date.getDate()}</span>
          <span
            className="wd-dot"
            style={{
              background: d.count === 0 ? 'transparent' : d.isToday ? 'var(--accent)' : 'var(--danger)',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** "16:00" chip used by the mobile reminder rows. */
export function ReminderChip({ iso }: { iso: string }) {
  return (
    <span className="task-when" style={{ background: 'var(--surface-2)', color: 'var(--text-dim)' }}>
      <Icon name="clock" size={13} />
      {clockTime(iso)}
    </span>
  );
}

/** A one-line summary for the mobile home screen's reminder card. */
export function NextReminder({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  const next = useMemo(() => {
    const now = Date.now();
    return items
      .filter((it) => it.remindAt && new Date(it.remindAt).getTime() >= now && !isDone(it))
      .sort((a, b) => (a.remindAt ?? '').localeCompare(b.remindAt ?? ''))[0];
  }, [items]);
  const { t } = useT();

  if (!next) return null;

  return (
    <div className="pin-card is-accent" style={{ flex: 'none' }}>
      <span className="pin-kind">
        <Icon name="bell" size={14} strokeWidth={2} />
        {t('rem.next', { when: reminderLabel(next.remindAt!) })}
      </span>
      <span className="pin-title">{next.title}</span>
      <span className="pin-sub">{t('rem.updated', { time: timeAgo(next.updatedAt) })}</span>
      <Button size="sm" onClick={() => onOpen(next.id)}>
        {t('item.open')}
      </Button>
    </div>
  );
}
