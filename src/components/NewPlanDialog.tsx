import { useState } from 'react';
import { roomBounds } from '../plan/shape';
import { projectStore } from '../store';
import { ROOM_LIMITS } from '../store/defaults';
import { Dialog } from './ui/Dialog';
import { NumberField } from './ui/NumberField';
import { toast } from './ui/toastStore';

export function NewPlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New plan"
      description="Replaces all rooms and layouts with one empty room. Add more rooms, doors and windows from the Floor plan tools. Export first if you want to keep a copy. Ctrl+Z undoes this."
    >
      {open && <NewPlanForm onDone={onClose} />}
    </Dialog>
  );
}

function NewPlanForm({ onDone }: { onDone: () => void }) {
  const [size, setSize] = useState(() => {
    const first = projectStore.getState().rooms[0];
    if (!first) return { width: 380, depth: 320 };
    const b = roomBounds(first);
    return { width: Math.round(b.maxX - b.minX), depth: Math.round(b.maxY - b.minY) };
  });

  const create = () => {
    projectStore.getState().newPlan(size.width, size.depth);
    toast('Started a new plan');
    onDone();
  };

  return (
    <>
      <div className="grid-2">
        <div>
          <span className="field-label">Room width</span>
          <NumberField label="Room width" suffix="cm" value={size.width} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onCommit={(width) => setSize((s) => ({ ...s, width }))} />
        </div>
        <div>
          <span className="field-label">Room depth</span>
          <NumberField label="Room depth" suffix="cm" value={size.depth} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onCommit={(depth) => setSize((s) => ({ ...s, depth }))} />
        </div>
      </div>
      <div className="dialog-footer" style={{ padding: '6px 0 0' }}>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={create}>
          Create plan
        </button>
      </div>
    </>
  );
}
