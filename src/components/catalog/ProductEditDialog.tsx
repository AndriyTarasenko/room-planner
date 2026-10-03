import { useState } from 'react';
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_ORDER } from '../../catalog/categories';
import { type ProductEdit, editProduct, productStandsOn } from '../../catalog/editProduct';
import { productTitle } from '../../catalog/format';
import type { CatalogCategory, FurnitureProduct } from '../../catalog/types';
import { userCatalogStore } from '../../catalog/userCatalog';
import { type ShapeChoice, shapeChoiceOf } from '../../furniture/shapeChoice';
import { projectStore, selectPlacedCopyCount, useEditor } from '../../store';
import { ShapeSizeFields, StandsOnField } from '../ObjectFields';
import { Dialog } from '../ui/Dialog';
import { toast } from '../ui/toastStore';

/** Changes a product saved in My furniture, and on request its copies already placed in the project. */
export function ProductEditDialog({ product, onClose }: { product: FurnitureProduct | null; onClose: () => void }) {
  return (
    <Dialog
      open={product !== null}
      onClose={onClose}
      title={product ? `Edit ${productTitle(product)}` : ''}
      description={product ? [product.manufacturer, product.variant, product.articleNumber].filter(Boolean).join(' · ') : undefined}
    >
      {product && <EditForm key={product.id} product={product} onDone={onClose} />}
    </Dialog>
  );
}

function initialEdit(product: FurnitureProduct): ProductEdit {
  return {
    name: productTitle(product),
    width: product.width,
    depth: product.depth,
    height: product.height,
    shape: shapeChoiceOf({ width: product.width, depth: product.depth, shape: product.shape ?? { kind: 'rect' } }),
    category: product.category,
    standsOn: productStandsOn(product),
  };
}

function EditForm({ product, onDone }: { product: FurnitureProduct; onDone: () => void }) {
  const [edit, setEdit] = useState(() => initialEdit(product));
  const placed = useEditor(selectPlacedCopyCount(product.id));
  const [updatePlaced, setUpdatePlaced] = useState(true);
  const set = (patch: Partial<ProductEdit>) => setEdit((e) => ({ ...e, ...patch }));

  const save = () => {
    const next = editProduct(product, edit);
    const stored = userCatalogStore.getState().updateProduct(next);
    const updated = placed > 0 && updatePlaced ? projectStore.getState().updatePlacedCopies(product, next) : 0;
    if (!stored) toast('Could not save to My furniture: browser storage is full or disabled.', 'error');
    else toast(updated > 0 ? `Saved ${productTitle(next)} and updated ${updated === 1 ? 'its placed copy' : `${updated} placed copies`}` : `Saved ${productTitle(next)}`);
    onDone();
  };

  return (
    <>
      <div>
        <span className="field-label">Name</span>
        <input
          className="text-input"
          aria-label="Name"
          value={edit.name}
          maxLength={120}
          onChange={(e) => set({ name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
        />
      </div>
      <ShapeSizeFields shape={edit.shape} onShape={(shape: ShapeChoice) => set({ shape })} size={edit} onSize={set} />
      <div>
        <span className="field-label">Category</span>
        <select className="select" value={edit.category} onChange={(e) => set({ category: e.target.value as CatalogCategory })}>
          {CATALOG_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATALOG_CATEGORIES[c].label}
            </option>
          ))}
        </select>
      </div>
      <StandsOnField value={edit.standsOn} onChange={(standsOn) => set({ standsOn })} />
      {placed > 0 && (
        <label className="checkbox" title="Only what you change here is applied; anything else you changed on a copy stays">
          <input type="checkbox" checked={updatePlaced} onChange={(e) => setUpdatePlaced(e.target.checked)} />
          {placed === 1 ? 'Also update the copy placed in this project' : `Also update the ${placed} copies placed in this project`}
        </label>
      )}
      <div className="dialog-footer" style={{ padding: '6px 0 0' }}>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={save}>
          Save
        </button>
      </div>
    </>
  );
}
