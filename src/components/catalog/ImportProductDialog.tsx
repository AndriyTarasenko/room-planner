import { AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_ORDER, DEFAULT_KIND } from '../../catalog/categories';
import { productTitle } from '../../catalog/format';
import { placeProduct } from '../../catalog/placeProduct';
import type { CatalogCategory, FurnitureProduct, LiveProductCandidate, ProductDimensions } from '../../catalog/types';
import { SHAPE_CHOICES, type ShapeChoice } from '../../furniture/shapeChoice';
import { userCatalogStore } from '../../catalog/userCatalog';
import { ITEM_LIMITS } from '../../store/defaults';
import { formatNumber, localDateString } from '../../utils/format';
import { parseNumberInput } from '../../utils/parseNumber';
import { Dialog } from '../ui/Dialog';
import { Segmented } from '../ui/controls';
import { toast } from '../ui/toastStore';

/**
 * Turns a live search result into a saved product. Dimensions are only prefilled when the
 * provider could read them unambiguously; either way the user sees where they come from
 * and confirms them, because a wrong footprint is worse than a missing one.
 */
export function ImportProductDialog({ candidate, onClose }: { candidate: LiveProductCandidate | null; onClose: () => void }) {
  const p = candidate?.product;
  return (
    <Dialog
      open={candidate !== null}
      onClose={onClose}
      title={p ? `Add ${productTitle(p)}` : ''}
      description={p ? [p.manufacturer, p.variant, p.articleNumber].filter(Boolean).join(' · ') : undefined}
    >
      {candidate && <ImportForm key={candidate.product.id} candidate={candidate} onDone={onClose} />}
    </Dialog>
  );
}

type SizeKey = keyof ProductDimensions;
const SIZE_FIELDS: { key: SizeKey; prefix: string; label: string }[] = [
  { key: 'width', prefix: 'W', label: 'Width' },
  { key: 'depth', prefix: 'D', label: 'Depth' },
  { key: 'height', prefix: 'H', label: 'Height' },
];

/** A circle has one size: the diameter, kept as the width. */
const ROUND_SIZE_FIELDS: typeof SIZE_FIELDS = [
  { key: 'width', prefix: 'Ø', label: 'Diameter' },
  { key: 'height', prefix: 'H', label: 'Height' },
];

function parseSize(text: string): number | null {
  const v = parseNumberInput(text);
  return Number.isFinite(v) && v >= ITEM_LIMITS.min && v <= ITEM_LIMITS.max ? Math.round(v * 10) / 10 : null;
}

function ImportForm({ candidate, onDone }: { candidate: LiveProductCandidate; onDone: () => void }) {
  const initial = candidate.dimensions;
  const [size, setSize] = useState<Record<SizeKey, string>>({
    width: initial ? formatNumber(initial.width) : '',
    depth: initial ? formatNumber(initial.depth) : '',
    height: initial ? formatNumber(initial.height) : '',
  });
  const [category, setCategory] = useState<CatalogCategory>(candidate.product.category);
  const [shape, setShape] = useState<ShapeChoice>(candidate.product.shape?.kind === 'round' ? 'round' : 'rect');
  const [showErrors, setShowErrors] = useState(false);
  const width = parseSize(size.width);
  const parsed = { width, depth: shape === 'round' ? width : parseSize(size.depth), height: parseSize(size.height) };
  const fields = shape === 'round' ? ROUND_SIZE_FIELDS : SIZE_FIELDS;
  const valid = parsed.width !== null && parsed.depth !== null && parsed.height !== null;

  const save = (andPlace: boolean) => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    const dims = parsed as ProductDimensions;
    const unchanged = initial !== null && SIZE_FIELDS.every(({ key }) => initial[key] === dims[key]);
    const product: FurnitureProduct = {
      ...candidate.product,
      category,
      kind: category === candidate.product.category ? candidate.product.kind : DEFAULT_KIND[category],
      ...dims,
      shape: shape === 'rect' ? undefined : { kind: 'round' },
      origin: 'user',
      metadata: { ...candidate.product.metadata, dimensionsSource: unchanged ? 'listing' : 'user', importedOn: localDateString() },
    };
    const stored = userCatalogStore.getState().saveProduct(product);
    if (andPlace) placeProduct(product);
    if (stored) toast(andPlace ? `Added ${productTitle(product)} and saved it to My furniture` : `Saved ${productTitle(product)} to My furniture`);
    else toast('Could not save to My furniture: browser storage is full or disabled.', 'error');
    onDone();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save(true);
    }
  };

  return (
    <>
      <div className={`notice${initial ? '' : ' warning'}`}>
        {initial ? <Info size={14} /> : <AlertTriangle size={14} />}
        <span>{candidate.dimensionsNote}</span>
      </div>
      {candidate.product.productUrl && (
        <a className="about-link" href={candidate.product.productUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
          Open the product page
          <span className="about-link-url">for its measurements</span>
        </a>
      )}
      <div>
        <span className="field-label">Shape</span>
        <Segmented<ShapeChoice> label="Shape" value={shape} onChange={setShape} options={SHAPE_CHOICES} />
      </div>
      <div>
        <span className="field-label">{shape === 'round' ? 'Size in cm' : 'Size in cm (width along the front, depth front to back)'}</span>
        <div className="grid-3">
          {fields.map(({ key, prefix, label }) => (
            <label key={key} className={`input${showErrors && parsed[key] === null ? ' invalid' : ''}`}>
              <span className="input-prefix">{prefix}</span>
              <input
                aria-label={label}
                inputMode="decimal"
                placeholder="?"
                autoFocus={key === 'width' && !initial}
                value={size[key]}
                onChange={(e) => setSize((s) => ({ ...s, [key]: e.target.value }))}
                onKeyDown={onKeyDown}
              />
            </label>
          ))}
        </div>
        {showErrors && !valid && (
          <p className="field-error">
            Enter {shape === 'round' ? 'the diameter and height' : 'all three dimensions'} ({ITEM_LIMITS.min}–{ITEM_LIMITS.max} cm).
          </p>
        )}
      </div>
      <div>
        <span className="field-label">Category</span>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value as CatalogCategory)}>
          {CATALOG_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATALOG_CATEGORIES[c].label}
            </option>
          ))}
        </select>
      </div>
      <div className="dialog-footer" style={{ padding: '6px 0 0' }}>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => save(false)}>
          Save only
        </button>
        <button type="button" className="btn btn-primary" onClick={() => save(true)}>
          Save and add
        </button>
      </div>
    </>
  );
}
