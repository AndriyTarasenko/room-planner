import { useState } from 'react';
import { projectStore } from '../store';
import { ROOM_LIMITS } from '../store/defaults';
import { Dialog } from './ui/Dialog';
import { NumberField } from './ui/NumberField';
import { toast } from './ui/toastStore';

export function NewRoomDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New empty room"
      description="Replaces the current room and all its layouts with one empty layout. Export first if you want to keep a copy. Ctrl+Z undoes this."
    >
      {open && <NewRoomForm onDone={onClose} />}
    </Dialog>
  );
}

function NewRoomForm({ onDone }: { onDone: () => void }) {
  const current = projectStore.getState().room;
  const [size, setSize] = useState({ width: current.width, depth: current.depth });

  const create = () => {
    projectStore.getState().newEmptyRoom(size.width, size.depth);
    toast('Started a new empty room');
    onDone();
  };

  return (
    <>
      <div className="grid-2">
        <div>
          <span className="field-label">Width</span>
          <NumberField label="Room width" suffix="cm" value={size.width} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onCommit={(width) => setSize((s) => ({ ...s, width }))} />
        </div>
        <div>
          <span className="field-label">Depth</span>
          <NumberField label="Room depth" suffix="cm" value={size.depth} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onCommit={(depth) => setSize((s) => ({ ...s, depth }))} />
        </div>
      </div>
      <div className="dialog-footer" style={{ padding: '6px 0 0' }}>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={create}>
          Create room
        </button>
      </div>
    </>
  );
}
