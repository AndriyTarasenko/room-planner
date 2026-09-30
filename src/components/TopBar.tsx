import { Download, FilePlus2, Redo2, Undo2, Upload } from 'lucide-react';
import { projectStore, useEditor } from '../store';
import { LayoutTabs } from './LayoutTabs';
import { exportProject, importProject } from './projectActions';

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

export function TopBar({ onNewRoom }: { onNewRoom: () => void }) {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { undo, redo } = projectStore.getState();

  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <span className="brand-text">Room Planner</span>
      </div>
      <LayoutTabs />
      <div className="topbar-actions">
        <button type="button" className="icon-btn" data-tip="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 size={16} />
        </button>
        <button type="button" className="icon-btn" data-tip="Redo (Ctrl+Y)" aria-label="Redo" disabled={!canRedo} onClick={redo}>
          <Redo2 size={16} />
        </button>
        <div className="divider-v" />
        <button type="button" className="btn" onClick={onNewRoom}>
          <FilePlus2 size={15} />
          New empty room
        </button>
        <button type="button" className="btn" onClick={importProject}>
          <Upload size={15} />
          Import
        </button>
        <button type="button" className="btn btn-secondary" onClick={exportProject}>
          <Download size={15} />
          Export JSON
        </button>
      </div>
    </header>
  );
}
