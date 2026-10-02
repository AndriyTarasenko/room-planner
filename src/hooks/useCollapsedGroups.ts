import { useState } from 'react';

/** Folded groups are a convenience: when storage is unavailable they just aren't remembered. */
function load(storageKey: string): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function save(storageKey: string, groups: ReadonlySet<string>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...groups]));
  } catch {
    // Private mode or full storage.
  }
}

/**
 * Which groups of a panel (library categories, overview sections) are collapsed, remembered in
 * this browser under `storageKey`.
 */
export function useCollapsedGroups(storageKey: string) {
  const [collapsed, setCollapsed] = useState(() => load(storageKey));
  const update = (next: Set<string>) => {
    setCollapsed(next);
    save(storageKey, next);
  };
  return {
    collapsed: collapsed as ReadonlySet<string>,
    toggle(id: string) {
      const next = new Set(collapsed);
      if (!next.delete(id)) next.add(id);
      update(next);
    },
    /** Collapses exactly these groups, or expands everything with an empty list. */
    collapseOnly(ids: readonly string[]) {
      update(new Set(ids));
    },
  };
}
