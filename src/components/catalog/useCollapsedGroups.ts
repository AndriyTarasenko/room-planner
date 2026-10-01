import { useState } from 'react';

const STORAGE_KEY = 'room-planner:library-collapsed';

/** Folded library groups are a convenience: when storage is unavailable they just aren't remembered. */
function load(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

function save(groups: ReadonlySet<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
  } catch {
    // Private mode or full storage.
  }
}

/** Which furniture library groups (categories, "recent") are collapsed, remembered in this browser. */
export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState(load);
  const update = (next: Set<string>) => {
    setCollapsed(next);
    save(next);
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
