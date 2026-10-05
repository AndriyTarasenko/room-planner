import { Check, ChevronUp, Copy, Eraser, RotateCw, Trash2, Undo2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { finishDrawing, stopDrawing, undoCorner } from '../../editor/drawTool';
import { clearMeasurement, stopMeasuring } from '../../editor/rulerTool';
import { useUi } from '../../editor/uiStore';
import { isCircle } from '../../geometry/footprint';
import { OPENING_DEFAULTS } from '../../plan/openings';
import { roomArea } from '../../plan/shape';
import { projectStore, selectRooms, selectSelectedItem, selectSelectedOpening, selectSelectedRoom, useEditor } from '../../store';
import { formatArea, formatCm, formatFootprint } from '../../utils/format';
import { OPENING_ICONS, ROOM_ICON } from '../planIcons';
import { deleteRoom } from '../projectActions';
import { useSheet } from './sheetStore';

/**
 * The bottom of the canvas on a phone: the selection with its quick actions, the controls of
 * the tool in use (no Enter or Escape on a touch screen), or how to get started.
 */
export function CanvasCard() {
  const tool = useUi((s) => s.tool);
  const sheet = useSheet((s) => s.open);
  const hasSelection = useEditor((s) => s.selectedId !== null);
  if (tool === 'draw') return <DrawBar />;
  if (tool === 'measure') return <MeasureBar />;
  // The open inspector shows the selection in full.
  if (sheet === 'details') return null;
  if (hasSelection) return <SelectionCard />;
  if (sheet) return null;
  return <div className="mobile-hint">Tap to edit · pinch to zoom · drag to pan</div>;
}

interface CardProps {
  icon: ReactNode;
  name: string;
  meta: string;
  children: ReactNode;
}

function Card({ icon, name, meta, children }: CardProps) {
  const { select } = projectStore.getState();
  return (
    <div className="canvas-card" role="toolbar" aria-label="Selection">
      <button type="button" className="canvas-card-main" aria-label={`Edit ${name}`} onClick={() => useSheet.getState().show('details')}>
        <span className="canvas-card-icon">{icon}</span>
        <span className="canvas-card-text">
          <span className="canvas-card-name">{name}</span>
          <span className="canvas-card-meta num">{meta}</span>
        </span>
        <ChevronUp size={16} className="canvas-card-chevron" />
      </button>
      {children}
      <span className="divider-v" />
      <button type="button" className="icon-btn" aria-label="Deselect" onClick={() => select(null)}>
        <X size={18} />
      </button>
    </div>
  );
}

function SelectionCard() {
  const item = useEditor(selectSelectedItem);
  const room = useEditor(selectSelectedRoom);
  const opening = useEditor(selectSelectedOpening);
  const roomCount = useEditor((s) => selectRooms(s).length);
  const s = projectStore.getState();

  if (item) {
    return (
      <Card
        icon={<span className="swatch" style={{ background: item.color }} />}
        name={item.name}
        meta={`${formatFootprint(item.width, item.depth, isCircle(item))} cm`}
      >
        <button type="button" className="icon-btn" aria-label="Rotate 90 degrees" onClick={() => s.rotateBy(item.id, 90)}>
          <RotateCw size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Duplicate" onClick={() => s.duplicateItem(item.id)}>
          <Copy size={18} />
        </button>
        <button type="button" className="icon-btn danger" aria-label="Delete" onClick={() => s.deleteItem(item.id)}>
          <Trash2 size={18} />
        </button>
      </Card>
    );
  }
  if (room) {
    return (
      <Card icon={ROOM_ICON} name={room.name} meta={formatArea(roomArea(room))}>
        <button type="button" className="icon-btn danger" aria-label="Delete room" disabled={roomCount <= 1} onClick={() => deleteRoom(room.id)}>
          <Trash2 size={18} />
        </button>
      </Card>
    );
  }
  if (opening) {
    return (
      <Card icon={OPENING_ICONS[opening.kind]} name={OPENING_DEFAULTS[opening.kind].label} meta={formatCm(opening.width)}>
        <button type="button" className="icon-btn danger" aria-label="Delete" onClick={() => s.deleteOpening(opening.id)}>
          <Trash2 size={18} />
        </button>
      </Card>
    );
  }
  return null;
}

function DrawBar() {
  const corners = useUi((s) => s.draft.points.length);
  const text =
    corners === 0 ? 'Tap where the first corner goes' : corners < 3 ? 'Tap to place the next corner' : 'Tap the first corner, or Finish';
  return (
    <div className="canvas-card mode-bar" role="toolbar" aria-label="Draw walls">
      <span className="mode-bar-text">{text}</span>
      <button type="button" className="icon-btn" aria-label="Remove the last corner" disabled={corners === 0} onClick={undoCorner}>
        <Undo2 size={18} />
      </button>
      <button type="button" className="btn btn-primary" disabled={corners < 3} onClick={finishDrawing}>
        <Check size={16} />
        Finish
      </button>
      <button type="button" className="icon-btn" aria-label="Stop drawing" onClick={stopDrawing}>
        <X size={18} />
      </button>
    </div>
  );
}

function MeasureBar() {
  const measured = useUi((s) => s.ruler.start !== null);
  return (
    <div className="canvas-card mode-bar" role="toolbar" aria-label="Measure">
      <span className="mode-bar-text">{measured ? 'Drag again for a new measurement' : 'Drag between two points'}</span>
      <button type="button" className="icon-btn" aria-label="Clear the measurement" disabled={!measured} onClick={clearMeasurement}>
        <Eraser size={18} />
      </button>
      <button type="button" className="btn btn-secondary" onClick={stopMeasuring}>
        Done
      </button>
    </div>
  );
}
