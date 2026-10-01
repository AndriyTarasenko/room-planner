import { useState } from 'react';
import { catalogCategoryForItemCategory } from '../catalog/categories';
import { placeProduct } from '../catalog/placeProduct';
import { CUSTOM_MANUFACTURER, type FurnitureProduct } from '../catalog/types';
import { userCatalogStore } from '../catalog/userCatalog';
import { CATEGORIES, CATEGORY_ORDER } from '../furniture/categories';
import type { CustomItemInput } from '../furniture/factory';
import { SHAPE_CHOICES, type ShapeChoice } from '../furniture/shapeChoice';
import { projectStore } from '../store';
import { ITEM_LIMITS } from '../store/defaults';
import type { Category, Placement } from '../types';
import { localDateString } from '../utils/format';
import { createId } from '../utils/id';
import { Dialog } from './ui/Dialog';
import { NumberField } from './ui/NumberField';
import { Segmented } from './ui/controls';
import { toast } from './ui/toastStore';

/** A custom object as a reusable product in My furniture. */
function customProduct(input: CustomItemInput): FurnitureProduct {
  return {
    id: createId('custom'),
    manufacturer: CUSTOM_MANUFACTURER,
    productName: input.name,
    category: catalogCategoryForItemCategory(input.category),
    kind: 'generic',
    width: input.width,
    depth: input.depth,
    height: input.height,
    placement: input.placement,
    ...(input.shape.kind === 'round' && { shape: input.shape }),
    origin: 'user',
    source: 'Entered by you',
    metadata: { dimensionsSource: 'user', importedOn: localDateString() },
  };
}

const INITIAL: Omit<CustomItemInput, 'shape'> = { name: '', width: 60, depth: 40, height: 50, category: 'other', placement: 'floor' };

export function CustomFurnitureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Custom object"
      description="Any rectangular or round object with exact dimensions. Everything can be changed later in the inspector."
    >
      {open && <CustomForm onDone={onClose} />}
    </Dialog>
  );
}

function CustomForm({ onDone }: { onDone: () => void }) {
  const [input, setInput] = useState(INITIAL);
  const [shape, setShape] = useState<ShapeChoice>('rect');
  const [saveToCatalog, setSaveToCatalog] = useState(false);
  const set = <K extends keyof typeof INITIAL>(key: K, value: (typeof INITIAL)[K]) => setInput((s) => ({ ...s, [key]: value }));

  const add = () => {
    const final: CustomItemInput = {
      ...input,
      name: input.name.trim() || 'Object',
      // A circle has one size: the diameter, entered as the width.
      depth: shape === 'round' ? input.width : input.depth,
      shape: { kind: shape === 'rect' ? 'rect' : 'round' },
    };
    if (saveToCatalog) {
      const product = customProduct(final);
      const stored = userCatalogStore.getState().saveProduct(product);
      placeProduct(product);
      if (!stored) toast('Could not save to My furniture: browser storage is full or disabled.', 'error');
    } else {
      projectStore.getState().addCustom(final);
    }
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
        <span className="field-label">Shape</span>
        <Segmented<ShapeChoice> label="Shape" value={shape} onChange={setShape} options={SHAPE_CHOICES} />
      </div>
      <div>
        <span className="field-label">Size</span>
        <div className="grid-3">
          {shape === 'round' ? (
            <NumberField label="Diameter" prefix="Ø" value={input.width} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(v) => set('width', v)} />
          ) : (
            <>
              <NumberField label="Width" prefix="W" value={input.width} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(v) => set('width', v)} />
              <NumberField label="Depth" prefix="D" value={input.depth} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(v) => set('depth', v)} />
            </>
          )}
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
      <label className="checkbox" title="Keep it in the furniture browser under My furniture, in this browser">
        <input type="checkbox" checked={saveToCatalog} onChange={(e) => setSaveToCatalog(e.target.checked)} />
        Save to My furniture for reuse
      </label>
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
