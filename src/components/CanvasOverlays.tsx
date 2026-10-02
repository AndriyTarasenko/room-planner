import type { ReactNode } from 'react';
import { CircleCheck, Grid3x3, Keyboard, Lock, Maximize, Minus, Plus, RulerDimensionLine, Scan, X } from 'lucide-react';
import { useUi } from '../editor/uiStore';
import { analyzeLayoutCached } from '../furniture/analysis';
import { clampZoom } from '../geometry/viewport';
import { projectStore, selectItems, selectSelectedItem, useEditor } from '../store';
import { GRID_SIZES, type GridSize, type Settings } from '../types';
import { formatArea, formatPercent } from '../utils/format';
import { useShortcutsPanel } from './shortcutsStore';

const SHORTCUTS: [string[], string][] = [
  [['Ctrl', 'Z'], 'Undo'],
  [['Ctrl', 'Y'], 'Redo'],
  [['R'], 'Rotate 90° (Shift: back)'],
  [['[', ']'], 'Rotate 15° (Shift: 1°)'],
  [['Ctrl', 'D'], 'Duplicate'],
  [['Del'], 'Delete'],
  [['←', '→', '↑', '↓'], 'Nudge 1 cm (Shift: 10)'],
  [['M'], 'Measure (Ruler)'],
  [['Alt'], 'Drag without snapping'],
  [['Esc'], 'Deselect'],
  [['?'], 'Show or hide this list'],
];

/** Toggle for a boolean setting. With an icon, the text collapses away on narrow canvases. */
function Chip({ settingKey, icon, children, tip }: { settingKey: keyof Settings; icon?: ReactNode; children: ReactNode; tip: string }) {
  const value = useEditor((s) => s.settings[settingKey]) as boolean;
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={value}
      data-tip={tip}
      data-tip-pos="top"
      onClick={() => projectStore.getState().updateSettings({ [settingKey]: !value })}
    >
      {icon}
      {icon ? <span className="chip-text">{children}</span> : children}
    </button>
  );
}

/** Floating toolbar under the canvas: grid, snapping and overlays. */
export function CanvasToolbar() {
  const gridSize = useEditor((s) => s.settings.gridSize);

  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas settings">
      <div className="toolbar-group">
        <Chip settingKey="gridVisible" icon={<Grid3x3 size={14} />} tip="Show grid">
          Grid
        </Chip>
        <select
          className="toolbar-select"
          aria-label="Grid size"
          value={gridSize}
          onChange={(e) => projectStore.getState().updateSettings({ gridSize: Number(e.target.value) as GridSize })}
        >
          {GRID_SIZES.map((g) => (
            <option key={g} value={g}>
              {g} cm
            </option>
          ))}
        </select>
      </div>
      <div className="divider-v" />
      <div className="toolbar-group">
        <span className="toolbar-label">Snap</span>
        <Chip settingKey="snapToGrid" tip="Snap to grid">
          Grid
        </Chip>
        <Chip settingKey="snapToWalls" tip="Snap to walls">
          Walls
        </Chip>
        <Chip settingKey="snapToFurniture" tip="Snap to nearby furniture">
          Furniture
        </Chip>
      </div>
      <div className="divider-v" />
      <div className="toolbar-group">
        <Chip settingKey="constrainToRoom" icon={<Lock size={13} />} tip="Keep furniture inside its room">
          Inside rooms
        </Chip>
        <Chip settingKey="showClearances" icon={<Scan size={14} />} tip="Show clearance zones">
          Clearances
        </Chip>
        <Chip settingKey="showMeasurements" icon={<RulerDimensionLine size={14} />} tip="Show distances for the selection">
          Distances
        </Chip>
      </div>
    </div>
  );
}

export function ZoomBar() {
  const zoom = useUi((s) => s.zoom);
  const { setView, resetView } = useUi.getState();
  const shortcutsOpen = useShortcutsPanel((s) => s.open);
  const toggleShortcuts = useShortcutsPanel((s) => s.toggle);
  // Buttons zoom around the view center.
  const zoomBy = (factor: number) => {
    const next = clampZoom(zoom * factor);
    const k = next / zoom;
    const { pan } = useUi.getState();
    setView(next, { x: pan.x * k, y: pan.y * k });
  };

  return (
    <div className="zoom-bar" role="toolbar" aria-label="Zoom">
      <div className="toolbar-group">
        <button type="button" className="icon-btn" aria-label="Zoom out" data-tip="Zoom out" data-tip-pos="top" onClick={() => zoomBy(1 / 1.25)}>
          <Minus size={15} />
        </button>
        <button type="button" className="zoom-value" data-tip="Fit plan to view" data-tip-pos="top" onClick={resetView}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="icon-btn" aria-label="Zoom in" data-tip="Zoom in (or scroll)" data-tip-pos="top" onClick={() => zoomBy(1.25)}>
          <Plus size={15} />
        </button>
        <button type="button" className="icon-btn" aria-label="Fit plan" data-tip="Fit plan" data-tip-pos="top" onClick={resetView}>
          <Maximize size={14} />
        </button>
      </div>
      <div className="divider-v" />
      <button
        type="button"
        className="icon-btn"
        aria-label="Keyboard shortcuts"
        aria-pressed={shortcutsOpen}
        data-tip="Keyboard shortcuts (?)"
        data-tip-pos="top"
        data-tip-align="end"
        onClick={toggleShortcuts}
      >
        <Keyboard size={15} />
      </button>
    </div>
  );
}

/** Keyboard shortcuts over the bottom-right of the canvas, above the zoom bar. */
export function ShortcutsPanel() {
  const open = useShortcutsPanel((s) => s.open);
  const toggle = useShortcutsPanel((s) => s.toggle);
  if (!open) return null;
  return (
    <section className="shortcuts-panel" aria-label="Keyboard shortcuts">
      <div className="shortcuts-panel-header">
        <h3 className="section-title" style={{ margin: 0 }}>
          Shortcuts
        </h3>
        <button type="button" className="icon-btn" aria-label="Hide shortcuts" data-tip="Hide (?)" onClick={toggle}>
          <X size={14} />
        </button>
      </div>
      <div className="shortcuts">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={label} style={{ display: 'contents' }}>
            <span className="kbd-group">
              {keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Conflict summary and free floor space, top-left of the canvas. */
export function CanvasStatus() {
  const items = useEditor(selectItems);
  const rooms = useEditor((s) => s.rooms);
  const analysis = analyzeLayoutCached(items, rooms);
  const select = (id: string | undefined) => id && projectStore.getState().select(id);

  const overlaps = analysis.collisions.length;
  const clearances = analysis.clearanceConflicts.length + analysis.wallBlockedClearanceIds.size;
  const doors = analysis.blockedDoorIds.size;
  const outside = analysis.outsideIds.size;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <div className="status" aria-live="polite">
      {overlaps > 0 && (
        <button type="button" className="status-chip danger" onClick={() => select(analysis.collisions[0].a)} title="Select the first overlapping object">
          <span className="dot" style={{ background: 'var(--danger)' }} />
          {plural(overlaps, 'overlap')}
        </button>
      )}
      {clearances > 0 && (
        <button type="button" className="status-chip warning" onClick={() => select(analysis.clearanceConflicts[0]?.intruderId ?? [...analysis.wallBlockedClearanceIds][0])}
          title="Select an object with blocked clearance">
          <span className="dot" style={{ background: 'var(--warning)' }} />
          {plural(clearances, 'blocked clearance')}
        </button>
      )}
      {doors > 0 && (
        <button type="button" className="status-chip warning" onClick={() => select(analysis.doorConflicts[0].itemId)} title="Select an object standing in a door's swing">
          <span className="dot" style={{ background: 'var(--warning)' }} />
          {plural(doors, 'blocked door')}
        </button>
      )}
      {outside > 0 && (
        <button type="button" className="status-chip danger" onClick={() => select([...analysis.outsideIds][0])} title="Select the object outside the rooms">
          <span className="dot" style={{ background: 'var(--danger)' }} />
          {outside} outside {rooms.length === 1 ? 'room' : 'rooms'}
        </button>
      )}
      {overlaps + clearances + doors + outside === 0 && items.length > 0 && (
        <span className="status-chip ok">
          <CircleCheck size={13} style={{ color: '#2f9e5a' }} />
          No conflicts
        </span>
      )}
      <span className="status-chip ok num" title="Floor area not covered by furniture">
        Free floor {formatArea(analysis.usage.free)} · {formatPercent(analysis.usage.ratio)}
      </span>
    </div>
  );
}

export function CanvasHint() {
  const drawing = useUi((s) => s.tool === 'draw');
  const measuring = useUi((s) => s.tool === 'measure');
  const placing = useUi((s) => s.ruler.phase === 'placing');
  const roomSelected = useEditor((s) => s.rooms.some((r) => r.id === s.selectedId));
  const itemSelected = useEditor((s) => selectSelectedItem(s) !== null);
  const text = drawing
    ? 'Click to place corners · click the first corner or press Enter to finish · Backspace undoes a corner · Esc stops'
    : measuring
      ? placing
        ? 'Click to place the other end · Esc cancels'
        : 'Drag between two points, or click both ends · Alt: no snapping · middle-drag pans · Esc stops'
      : roomSelected
      ? 'Drag a wall or corner to reshape · double-click a wall to add a corner, a corner to remove it'
      : itemSelected
      ? 'Drag the round handle to rotate · Shift: 15° steps · Alt: no snapping · [ ] turn by 15°'
      : 'Click a room to edit it · scroll to zoom · drag the floor to pan';
  return <div className="hint">{text}</div>;
}
