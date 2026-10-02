import { Copy, CopyPlus, Ellipsis, Layers2, Pencil, Plus, Trash2, Unlink } from 'lucide-react';
import { useState } from 'react';
import { projectStore, useEditor } from '../store';
import type { Layout } from '../types';
import { layoutNames, unlinkLayoutPlan } from './projectActions';
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
          sharedWith={layouts.filter((l) => l.id !== layout.id && l.planId === layout.planId).map((l) => l.name)}
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
              icon={<Layers2 size={15} />}
              onSelect={() => {
                close();
                duplicateLayout(projectStore.getState().activeLayoutId, { ownPlan: true });
              }}
            >
              Duplicate with its own floor plan
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
  /** Names of the other layouts on this layout's floor plan. */
  sharedWith: string[];
  onStartRename: () => void;
  onEndRename: () => void;
}

function LayoutTab({ layout, active, renaming, canDelete, sharedWith, onStartRename, onEndRename }: TabProps) {
  const { switchLayout, renameLayout, duplicateLayout, deleteLayout } = projectStore.getState();
  const sharing = sharedWith.length > 0 ? `. Floor plan shared with ${layoutNames(sharedWith)}` : '';

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
        title={`${layout.name}${sharing}. Double-click to rename`}
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
              <MenuItem
                icon={<Layers2 size={15} />}
                onSelect={() => {
                  close();
                  duplicateLayout(layout.id, { ownPlan: true });
                }}
              >
                Duplicate with its own floor plan
              </MenuItem>
              {sharedWith.length > 0 && (
                <MenuItem
                  icon={<Unlink size={15} />}
                  onSelect={() => {
                    close();
                    unlinkLayoutPlan(layout.id);
                  }}
                >
                  Unlink floor plan
                </MenuItem>
              )}
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
