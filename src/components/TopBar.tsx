import { Download, EllipsisVertical, FilePlus2, Info, Redo2, Undo2, Upload } from 'lucide-react';
import { projectStore, useEditor } from '../store';
import { LayoutTabs } from './LayoutTabs';
import { exportProject, importProject } from './projectActions';
import { Menu, MenuItem, MenuSeparator } from './ui/Menu';

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 20 20" aria-hidden="true">
      <rect x="1" y="1" width="18" height="18" rx="4" fill="#1f2328" />
      <rect x="4.5" y="4.5" width="11" height="11" fill="none" stroke="#fff" strokeWidth="1.4" />
      <rect x="6" y="6" width="5.5" height="3" fill="#4d7cfe" />
      <rect x="11.5" y="10.5" width="2.5" height="3.5" fill="#c8ccd4" />
    </svg>
  );
}

interface Props {
  onNewPlan: () => void;
  onAbout: () => void;
  /** Phone layout: the layout tabs get the room, and the project actions go into a menu. */
  mobile: boolean;
}

export function TopBar({ onNewPlan, onAbout, mobile }: Props) {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { undo, redo } = projectStore.getState();

  return (
    <header className="topbar">
      {!mobile && (
        <div className="brand">
          <BrandMark />
          <span className="brand-text">Room Planner</span>
        </div>
      )}
      <LayoutTabs />
      <div className="topbar-actions">
        <button type="button" className="icon-btn" data-tip="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 size={16} />
        </button>
        <button type="button" className="icon-btn" data-tip="Redo (Ctrl+Y)" aria-label="Redo" disabled={!canRedo} onClick={redo}>
          <Redo2 size={16} />
        </button>
        {mobile ? (
          <Menu
            align="end"
            trigger={({ toggle }) => (
              <button type="button" className="icon-btn" aria-label="Project" onClick={toggle}>
                <EllipsisVertical size={18} />
              </button>
            )}
          >
            {(close) => {
              const run = (action: () => void) => () => {
                close();
                action();
              };
              return (
                <>
                  <MenuItem icon={<FilePlus2 size={16} />} onSelect={run(onNewPlan)}>
                    New plan
                  </MenuItem>
                  <MenuItem icon={<Upload size={16} />} onSelect={run(importProject)}>
                    Import
                  </MenuItem>
                  <MenuItem icon={<Download size={16} />} onSelect={run(exportProject)}>
                    Export JSON
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Info size={16} />} onSelect={run(onAbout)}>
                    About Room Planner
                  </MenuItem>
                </>
              );
            }}
          </Menu>
        ) : (
          <>
            <div className="divider-v" />
            <button type="button" className="btn" onClick={onNewPlan}>
              <FilePlus2 size={15} />
              New plan
            </button>
            <button type="button" className="btn" onClick={importProject}>
              <Upload size={15} />
              Import
            </button>
            <button type="button" className="btn btn-secondary" onClick={exportProject}>
              <Download size={15} />
              Export JSON
            </button>
            <button type="button" className="icon-btn" data-tip="About" aria-label="About Room Planner" onClick={onAbout}>
              <Info size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
