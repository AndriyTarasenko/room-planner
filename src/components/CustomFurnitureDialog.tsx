import { useState } from 'react';
import { CATEGORIES, CATEGORY_ORDER } from '../furniture/categories';
import type { CustomItemInput } from '../furniture/factory';
import { projectStore } from '../store';
import { ITEM_LIMITS } from '../store/defaults';
import type { Category, Placement } from '../types';
import { Dialog } from './ui/Dialog';
import { NumberField } from './ui/NumberField';
import { Segmented } from './ui/controls';

const INITIAL: CustomItemInput = { name: '', width: 60, depth: 40, height: 50, category: 'other', placement: 'floor' };

export function CustomFurnitureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Custom object"
      description="Any rectangular object with exact dimensions. Everything can be changed later in the inspector."
    >
      {open && <CustomForm onDone={onClose} />}
    </Dialog>
  );
}

function CustomForm({ onDone }: { onDone: () => void }) {
  const [input, setInput] = useState(INITIAL);
  const set = <K extends keyof CustomItemInput>(key: K, value: CustomItemInput[K]) => setInput((s) => ({ ...s, [key]: value }));

  const add = () => {
    projectStore.getState().addCustom({ ...input, name: input.name.trim() || 'Object' });
    onDone();
  };

  return (
    <>
      <div>
        <span className="field-label">Name</span>
        <input
          className="text-input"
          autoFocus
          placeholder="e.g. Docking station, Speaker, Plant"
          value={input.name}
          maxLength={120}
          onChange={(e) => set('name', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>
      <div>
        <span className="field-label">Size</span>
        <div className="grid-3">
          <NumberField label="Width" prefix="W" value={input.width} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(v) => set('width', v)} />
          <NumberField label="Depth" prefix="D" value={input.depth} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(v) => set('depth', v)} />
          <NumberField label="Height" prefix="H" value={input.height} min={0} max={ITEM_LIMITS.max} onCommit={(v) => set('height', v)} />
        </div>
      </div>
      <div className="grid-2">
        <div>
          <span className="field-label">Category</span>
          <select className="select" value={input.category} onChange={(e) => set('category', e.target.value as Category)}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="field-label">Stands on</span>
          <Segmented<Placement>
            label="Placement"
            value={input.placement}
            onChange={(v) => set('placement', v)}
            options={[
              { value: 'floor', label: 'Floor' },
              { value: 'surface', label: 'Furniture', title: 'Sits on a desk or sideboard (like a monitor)' },
            ]}
          />
        </div>
      </div>
      <div className="dialog-footer" style={{ padding: '6px 0 0' }}>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={add}>
          Add object
        </button>
      </div>
    </>
  );
}
