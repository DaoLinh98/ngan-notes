import { useCallback, useState } from 'react';

/**
 * Multi-select state for a list. Both shells keep their own instance, the same
 * way they keep their own navigation state.
 *
 * Selection deliberately survives filter and query changes: the user may tick
 * items in one folder, switch folders, and delete the whole set in one go.
 */
export interface Selection {
  /** True once the user has entered selection mode. */
  active: boolean;
  ids: Set<string>;
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Ticks every id in the list, or clears the set if they are all already in. */
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  start: () => void;
  /** Leaves selection mode and drops the set. */
  cancel: () => void;
}

export function useSelection(): Selection {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((all: string[]) => {
    setIds((prev) => (all.every((id) => prev.has(id)) ? new Set() : new Set(all)));
  }, []);

  const clear = useCallback(() => setIds(new Set()), []);

  const start = useCallback(() => setActive(true), []);

  const cancel = useCallback(() => {
    setIds(new Set());
    setActive(false);
  }, []);

  const has = useCallback((id: string) => ids.has(id), [ids]);

  return {
    active,
    ids,
    count: ids.size,
    has,
    toggle,
    toggleAll,
    clear,
    start,
    cancel,
  };
}
