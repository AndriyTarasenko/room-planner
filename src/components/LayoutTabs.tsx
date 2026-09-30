import { Copy, CopyPlus, Ellipsis, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { projectStore, useEditor } from '../store';
import type { Layout } from '../types';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';
import { toast } from './ui/toastStore';

/** Layout variants as tabs: click to switch, double-click to rename, ⋯ for more. */
export function LayoutTabs() {
  const layouts = useEditor((s) => s.layouts);
  const activeId = useEditor((s) => s.activeLayoutId);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const { createLayout, duplicateLayout } = projectStore.getState();

  return (
    <div className="tabs" role="tablist" aria-label="Layouts">
      {layouts.map((layout) => (
        <LayoutTab
          key={layout.id}
          layout={layout}
          active={layout.id === activeId}
          renaming={layout.id === renamingId}
          canDelete={layouts.length > 1}
          onStartRename={() => setRenamingId(layout.id)}
          onEndRename={() => setRenamingId(null)}
        />
      ))}
      <Menu
        trigger={({ toggle }) => (
          <button type="button" className="icon-btn" title="Add layout" aria-label="Add layout" onClick={toggle}>
            <Plus size={16} />
          </button>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon={<CopyPlus size={15} />}
              onSelect={() => {
                close();
                duplicateLayout(projectStore.getState().activeLayoutId);
              }}
            >
              Duplicate current layout
            </MenuItem>
            <MenuItem
              icon={<Plus size={15} />}
              onSelect={() => {
                close();
                createLayout();
              }}
            >
              New empty layout
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
}

interface TabProps {
  layout: Layout;
  active: boolean;
  renaming: boolean;
  canDelete: boolean;
  onStartRename: () => void;
  onEndRename: () => void;
}

function LayoutTab({ layout, active, renaming, canDelete, onStartRename, onEndRename }: TabProps) {
  const { switchLayout, renameLayout, duplicateLayout, deleteLayout } = projectStore.getState();

  if (renaming) {
    const finish = (value: string | null) => {
      if (value !== null) renameLayout(layout.id, value);
      onEndRename();
    };
    return (
      <div className="tab active">
        <input
          className="tab-rename"
          aria-label="Layout name"
          defaultValue={layout.name}
          maxLength={80}
          autoFocus
          onFocus={(e) => e.target.select()}
          onBlur={(e) => finish(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finish(e.currentTarget.value);
            if (e.key === 'Escape') finish(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className={`tab${active ? ' active' : ''}`}>
      <button
        type="button"
        role="tab"
        aria-selected={active}
        className="tab-label"
        title={`${layout.name}. Double-click to rename`}
        onClick={() => switchLayout(layout.id)}
        onDoubleClick={onStartRename}
      >
        {layout.name}
        <span className="tab-count num">{layout.furniture.length}</span>
      </button>
      {active && (
        <Menu
          trigger={({ toggle }) => (
            <button type="button" className="icon-btn tab-menu-btn" aria-label="Layout options" title="Layout options" onClick={toggle}>
              <Ellipsis size={14} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<Pencil size={15} />}
                onSelect={() => {
                  close();
                  onStartRename();
                }}
              >
                Rename
              </MenuItem>
              <MenuItem
                icon={<Copy size={15} />}
                onSelect={() => {
                  close();
                  duplicateLayout(layout.id);
                }}
              >
                Duplicate
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                danger
                icon={<Trash2 size={15} />}
                disabled={!canDelete}
                onSelect={() => {
                  close();
                  deleteLayout(layout.id);
                  toast(`Deleted “${layout.name}”. Press Ctrl+Z to restore it.`);
                }}
              >
                Delete layout
              </MenuItem>
            </>
          )}
        </Menu>
      )}
    </div>
  );
}
