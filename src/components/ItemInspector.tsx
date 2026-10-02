import { AlertTriangle, BringToFront, Copy, ExternalLink, RotateCw, SendToBack, Trash2 } from 'lucide-react';
import { type Issue, analyzeLayoutCached } from '../furniture/analysis';
import { CATEGORIES, CATEGORY_ORDER, COLOR_SWATCHES } from '../furniture/categories';
import { DESK_WIDTHS, MONITOR_SIZES, TV_SIZES, TYPE_LABELS } from '../furniture/presets';
import { canHostSurfaceItems, isDesk } from '../furniture/rules';
import { SHAPE_CHOICES, type ShapeChoice, applyShapeChoice, canBeRound, shapeChoiceOf } from '../furniture/shapeChoice';
import { CLEARANCE_SIDES } from '../geometry/clearance';
import { type WallDistances, wallDistances } from '../geometry/distances';
import { footprintBox, isCircle, lArms } from '../geometry/footprint';
import { L_MIN_ARM } from '../geometry/lShape';
import { isQuarterTurn, normalizeAngle } from '../geometry/rect';
import { roomForBox } from '../plan/rooms';
import { roomBounds } from '../plan/shape';
import { projectStore, selectItems, selectRooms, useEditor } from '../store';
import { ITEM_LIMITS } from '../store/defaults';
import type { Category, Clearance, FurnitureItem, FurnitureType, Placement, ProductRef } from '../types';
import { formatNumber } from '../utils/format';
import { safeHttpUrl } from '../utils/validate';
import { NumberField } from './ui/NumberField';
import { Section, Segmented, Switch, TextField } from './ui/controls';

const SIDE_PREFIX: Record<keyof Omit<Clearance, 'enabled'>, string> = { front: 'Front', back: 'Back', left: 'Left', right: 'Right' };

/** Properties and actions for the selected object. */
export function ItemInspector({ item }: { item: FurnitureItem }) {
  const rooms = useEditor(selectRooms);
  const items = useEditor(selectItems);
  const actions = projectStore.getState();
  const analysis = analyzeLayoutCached(items, rooms);
  const issues = analysis.issues.filter((i) => i.itemId === item.id);
  const box = footprintBox(item);
  // Positions and wall distances are measured in the item's own room.
  const room = roomForBox(box, rooms);
  const walls = wallDistances(box, room.corners);
  // X and Y are the distances to the walls on the left and above (for a rectangle, from its
  // top-left corner); where no wall is in line, they count from the room's outer extent.
  const bounds = roomBounds(room);
  const boxLeft = Number.isFinite(walls.left) ? walls.left : box.minX - bounds.minX;
  const boxTop = Number.isFinite(walls.top) ? walls.top : box.minY - bounds.minY;
  const host = item.attachedTo ? items.find((i) => i.id === item.attachedTo) : undefined;
  const update = (patch: Parameters<typeof actions.updateItem>[1]) => actions.updateItem(item.id, patch);

  return (
    <div>
      <div className="inspector-head">
        <TextField className="name-input" label="Name" value={item.name} maxLength={120} onCommit={(name) => update({ name: name.trim() || TYPE_LABELS[item.type] })} />
        <div className="inspector-meta">
          <span>{TYPE_LABELS[item.type]}</span>
          <span aria-hidden="true">·</span>
          <span>{host ? `On ${host.name}` : item.placement === 'surface' ? 'On furniture' : 'Floor'}</span>
        </div>
        <div className="inspector-actions">
          <button type="button" className="icon-btn" data-tip="Rotate 90° (R)" aria-label="Rotate 90 degrees" onClick={() => actions.rotateBy(item.id, 90)}>
            <RotateCw size={16} />
          </button>
          <button type="button" className="icon-btn" data-tip="Duplicate (Ctrl+D)" aria-label="Duplicate" onClick={() => actions.duplicateItem(item.id)}>
            <Copy size={16} />
          </button>
          <button type="button" className="icon-btn" data-tip="Bring to front" aria-label="Bring to front" onClick={() => actions.bringToFront(item.id)}>
            <BringToFront size={16} />
          </button>
          <button type="button" className="icon-btn" data-tip="Send backward" aria-label="Send backward" onClick={() => actions.sendBackward(item.id)}>
            <SendToBack size={16} />
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="icon-btn danger" data-tip="Delete (Del)" aria-label="Delete" onClick={() => actions.deleteItem(item.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <Section>
          <IssueList issues={issues} />
        </Section>
      )}

      {item.product && <ProductSection product={item.product} />}
      <SizeSection item={item} />
      <PositionSection item={item} walls={walls} boxLeft={boxLeft} boxTop={boxTop} roomName={rooms.length > 1 ? room.name : null} />
      <PlacementSection item={item} items={items} />
      <ClearanceSection item={item} />
      {isDesk(item) && (
        <Section>
          <div className="toggle-row">
            <span>
              Desk guides
              <span className="desc">Monitor area, reach zone and chair spot</span>
            </span>
            <Switch label="Show desk guides" checked={item.showDeskGuides} onChange={(showDeskGuides) => update({ showDeskGuides })} />
          </div>
        </Section>
      )}
      <AppearanceSection item={item} />
      <Section title="Notes">
        <TextField multiline label="Notes" placeholder="Product link, price, reminders…" value={item.notes} maxLength={5000} onCommit={(notes) => update({ notes })} />
      </Section>
    </div>
  );
}

export function IssueList({ issues, onSelect }: { issues: Issue[]; onSelect?: (issue: Issue) => void }) {
  return (
    <div className="issues">
      {issues.map((issue, i) => {
        const content = (
          <>
            <AlertTriangle size={14} />
            <span>{issue.message}</span>
          </>
        );
        return onSelect ? (
          <button type="button" key={i} className={`issue ${issue.kind}`} onClick={() => onSelect(issue)}>
            {content}
          </button>
        ) : (
          <div key={i} className={`issue ${issue.kind}`}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/** The product this item was created from (its own copy; the catalog isn't consulted). */
function ProductSection({ product }: { product: ProductRef }) {
  const url = safeHttpUrl(product.productUrl);
  const details = [product.variant, product.articleNumber && `Article ${product.articleNumber}`].filter(Boolean).join(' · ');
  return (
    <Section title="Product" aside={<span className="section-hint">{product.manufacturer}</span>}>
      <div className="product-ref">
        <div className="product-ref-name">{[product.productName, product.productType].filter(Boolean).join(' ')}</div>
        {details && <div className="product-ref-meta">{details}</div>}
        {product.sourceLastVerified && <div className="product-ref-meta">Catalog size checked on {product.sourceLastVerified}</div>}
        {url && (
          <a className="about-link product-ref-link" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={13} />
            Product page
          </a>
        )}
      </div>
    </Section>
  );
}

/** What the depth of an L-shape's main part means for each kind. */
const L_DEPTH_LABEL: Partial<Record<FurnitureType, string>> = { sofa: 'Seat depth', 'kitchen-cabinet': 'Counter depth' };

function SizeSection({ item }: { item: FurnitureItem }) {
  const { resizeItem, updateItem } = projectStore.getState();
  const isRegularDesk = item.type === 'desk' || item.type === 'sit-stand-desk';
  const screens = item.type === 'monitor' ? MONITOR_SIZES : item.type === 'tv' ? TV_SIZES : null;
  const screenMatch = screens?.find((m) => m.width === item.width && m.depth === item.depth);
  const lDepthLabel = L_DEPTH_LABEL[item.type] ?? 'Top depth';
  const circle = isCircle(item);
  const setShape = (choice: ShapeChoice) => {
    const { shape, width, depth } = applyShapeChoice(item, choice);
    resizeItem(item.id, { width, depth }, { shape });
  };

  return (
    <Section title="Size" aside={<span className="section-hint">cm</span>}>
      <div className="grid-3">
        {circle ? (
          <NumberField
            label="Diameter"
            prefix="Ø"
            value={item.width}
            min={ITEM_LIMITS.min}
            max={ITEM_LIMITS.max}
            onCommit={(diameter) => resizeItem(item.id, { width: diameter, depth: diameter })}
          />
        ) : (
          <>
            <NumberField label="Width" prefix="W" value={item.width} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(width) => resizeItem(item.id, { width })} />
            <NumberField label="Depth" prefix="D" value={item.depth} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(depth) => resizeItem(item.id, { depth })} />
          </>
        )}
        <NumberField label="Height" prefix="H" value={item.height} min={0} max={ITEM_LIMITS.max} onCommit={(height) => updateItem(item.id, { height })} />
      </div>

      {canBeRound(item) && (
        <div className="quick-sizes">
          <Segmented<ShapeChoice> label="Shape" value={shapeChoiceOf(item)} onChange={setShape} options={SHAPE_CHOICES} />
        </div>
      )}

      {isRegularDesk && (
        <div className="quick-sizes">
          <Segmented<number>
            label="Desk width"
            value={DESK_WIDTHS.includes(item.width as (typeof DESK_WIDTHS)[number]) ? item.width : null}
            onChange={(width) => resizeItem(item.id, { width })}
            options={DESK_WIDTHS.map((w) => ({ value: w, label: String(w), title: `${w} × ${formatNumber(item.depth)} cm` }))}
          />
        </div>
      )}

      {screens && (
        <div className="quick-sizes">
          <Segmented<number>
            label={`${TYPE_LABELS[item.type]} size`}
            value={screenMatch?.inches ?? null}
            onChange={(inches) => {
              const m = screens.find((s) => s.inches === inches)!;
              const prefix = TYPE_LABELS[item.type];
              const renamed = new RegExp(`^${prefix} \\d+″$`).test(item.name) ? { name: `${prefix} ${m.label}` } : {};
              resizeItem(item.id, { width: m.width, depth: m.depth }, { height: m.height, ...renamed });
            }}
            options={screens.map((m) => ({ value: m.inches, label: m.label, title: `${m.width} × ${m.depth} cm footprint` }))}
          />
        </div>
      )}

      {item.shape.kind === 'l' && (
        <>
          <div className="grid-2" style={{ marginTop: 8 }}>
            <div>
              <span className="field-label">{lDepthLabel}</span>
              <NumberField
                label={`L-shape ${lDepthLabel.toLowerCase()}`}
                suffix="cm"
                value={lArms(item.width, item.depth, item.shape).main}
                min={Math.min(L_MIN_ARM, item.depth - 1)}
                max={Math.max(1, item.depth - 1)}
                onCommit={(segment) => item.shape.kind === 'l' && updateItem(item.id, { shape: { ...item.shape, segment } })}
              />
            </div>
            <div>
              <span className="field-label">Return depth</span>
              <NumberField
                label="L-shape return depth"
                suffix="cm"
                value={lArms(item.width, item.depth, item.shape).leg}
                min={Math.min(L_MIN_ARM, item.width - 1)}
                max={Math.max(1, item.width - 1)}
                onCommit={(returnWidth) => item.shape.kind === 'l' && updateItem(item.id, { shape: { ...item.shape, returnWidth } })}
              />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <span className="field-label">Return side</span>
            <Segmented<'left' | 'right'>
              label="Return side"
              value={item.shape.returnSide}
              onChange={(returnSide) => item.shape.kind === 'l' && updateItem(item.id, { shape: { ...item.shape, returnSide } })}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
            />
          </div>
        </>
      )}
    </Section>
  );
}

interface PositionProps {
  item: FurnitureItem;
  walls: WallDistances;
  /** Left and top edge of the footprint, measured from the room's inner top-left corner. */
  boxLeft: number;
  boxTop: number;
  /** Shown when the plan has several rooms, so it's clear which walls the numbers refer to. */
  roomName: string | null;
}

function PositionSection({ item, walls, boxLeft, boxTop, roomName }: PositionProps) {
  const { setGeometry } = projectStore.getState();
  const rotation = normalizeAngle(item.rotation);
  const quarter = isQuarterTurn(rotation) ? Math.round(rotation) % 360 : null;

  return (
    <Section title="Position" aside={<span className="section-hint">{roomName ? `in ${roomName}, from top-left` : 'from top-left corner'}</span>}>
      <div className="grid-3">
        <NumberField
          label="X position (distance from left wall)"
          prefix="X"
          value={boxLeft}
          title="Distance of the left edge from the left wall"
          onCommit={(x) => setGeometry(item.id, { x: item.x + (x - boxLeft) })}
        />
        <NumberField
          label="Y position (distance from top wall)"
          prefix="Y"
          value={boxTop}
          title="Distance of the top edge from the top wall"
          onCommit={(y) => setGeometry(item.id, { y: item.y + (y - boxTop) })}
        />
        <NumberField label="Rotation" prefix="↻" suffix="°" value={rotation} step={15} onCommit={(r) => setGeometry(item.id, { rotation: r })} />
      </div>
      <div style={{ marginTop: 8 }}>
        <Segmented<number>
          label="Rotation"
          value={quarter}
          onChange={(r) => setGeometry(item.id, { rotation: r })}
          options={[0, 90, 180, 270].map((r) => ({ value: r, label: `${r}°` }))}
        />
      </div>
      <div className="readout" aria-label="Distance to walls">
        {(['left', 'right', 'top', 'bottom'] as const).map((side) => {
          const v = walls[side];
          const cls = v < -0.05 ? 'bad' : Math.abs(v) < 0.05 ? 'touch' : '';
          return (
            <div key={side}>
              <span className="readout-label">{side[0].toUpperCase() + side.slice(1)}</span>
              <span className={`readout-value ${cls}`}>{Number.isFinite(v) ? formatNumber(v) : '–'}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function PlacementSection({ item, items }: { item: FurnitureItem; items: readonly FurnitureItem[] }) {
  const { updateItem, attachTo } = projectStore.getState();
  const hosts = items.filter((i) => i.id !== item.id && canHostSurfaceItems(i));

  return (
    <Section title="Placement">
      <div className="stack">
        <Segmented<Placement>
          label="Stands on"
          value={item.placement}
          onChange={(placement) => updateItem(item.id, { placement })}
          options={[
            { value: 'floor', label: 'Floor' },
            { value: 'surface', label: 'On furniture', title: 'Sits on a desk or sideboard, like a monitor' },
          ]}
        />
        {item.placement === 'surface' && (
          <div>
            <span className="field-label">Moves with</span>
            <select className="select" value={item.attachedTo ?? ''} onChange={(e) => attachTo(item.id, e.target.value || null)}>
              <option value="">Nothing (free)</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="checkbox" title="For things tucked under other furniture, like a PC under a desk">
          <input type="checkbox" checked={item.ignoreCollisions} onChange={(e) => updateItem(item.id, { ignoreCollisions: e.target.checked })} />
          Allow overlaps (no collision warnings)
        </label>
      </div>
    </Section>
  );
}

function ClearanceSection({ item }: { item: FurnitureItem }) {
  const { updateItem } = projectStore.getState();
  const c = item.clearance;
  const set = (patch: Partial<Clearance>) => updateItem(item.id, { clearance: { ...c, ...patch } });
  const hasAny = CLEARANCE_SIDES.some((s) => c[s] > 0);

  return (
    <Section
      title="Clearance"
      aside={
        <Switch
          label="Clearance zone"
          checked={c.enabled}
          onChange={(enabled) => set(enabled && !hasAny ? { enabled, front: 60 } : { enabled })}
        />
      }
    >
      {c.enabled ? (
        <div className="grid-2">
          {CLEARANCE_SIDES.map((side) => (
            <NumberField key={side} label={`${SIDE_PREFIX[side]} clearance`} prefix={SIDE_PREFIX[side]} suffix="cm" value={c[side]} min={0} max={1000} step={5} onCommit={(v) => set({ [side]: v })} />
          ))}
        </div>
      ) : (
        <p className="empty-note" style={{ margin: 0 }}>
          Free space this object needs, e.g. for doors or rolling a chair back. Other furniture inside it is flagged, but not as a collision.
        </p>
      )}
    </Section>
  );
}

function AppearanceSection({ item }: { item: FurnitureItem }) {
  const { updateItem } = projectStore.getState();
  return (
    <Section title="Appearance">
      <div className="stack">
        <select className="select" aria-label="Category" value={item.category} onChange={(e) => updateItem(item.id, { category: e.target.value as Category })}>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORIES[c].label}
            </option>
          ))}
        </select>
        <div className="swatches" role="group" aria-label="Color">
          {COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className="swatch-btn"
              style={{ background: color }}
              aria-label={`Color ${color}`}
              aria-pressed={item.color.toLowerCase() === color.toLowerCase()}
              onClick={() => updateItem(item.id, { color })}
            />
          ))}
          <input
            type="color"
            className="color-input"
            aria-label="Custom color"
            title="Custom color"
            value={item.color.length === 7 ? item.color : '#cccccc'}
            onChange={(e) => updateItem(item.id, { color: e.target.value }, { coalesceKey: `color:${item.id}` })}
          />
        </div>
      </div>
    </Section>
  );
}
