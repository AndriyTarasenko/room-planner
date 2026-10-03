import { SHAPE_CHOICES, type ShapeChoice } from '../furniture/shapeChoice';
import { STANDS_ON_CHOICES, type StandsOn } from '../furniture/standsOn';
import { ITEM_LIMITS } from '../store/defaults';
import { NumberField } from './ui/NumberField';
import { Segmented } from './ui/controls';

export interface ObjectSize {
  width: number;
  depth: number;
  height: number;
}

interface ShapeSizeProps {
  /** Null hides the shape switch, for shapes it doesn't offer (L-shapes). */
  shape: ShapeChoice | null;
  onShape: (shape: ShapeChoice) => void;
  size: ObjectSize;
  onSize: (patch: Partial<ObjectSize>) => void;
}

/** Shape switch and size fields of the object dialogs. A circle has one size, its diameter, kept as the width. */
export function ShapeSizeFields({ shape, onShape, size, onSize }: ShapeSizeProps) {
  return (
    <>
      {shape && (
        <div>
          <span className="field-label">Shape</span>
          <Segmented<ShapeChoice> label="Shape" value={shape} onChange={onShape} options={SHAPE_CHOICES} />
        </div>
      )}
      <div>
        <span className="field-label">Size</span>
        <div className="grid-3">
          {shape === 'round' ? (
            <NumberField label="Diameter" prefix="Ø" value={size.width} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(width) => onSize({ width })} />
          ) : (
            <>
              <NumberField label="Width" prefix="W" value={size.width} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(width) => onSize({ width })} />
              <NumberField label="Depth" prefix="D" value={size.depth} min={ITEM_LIMITS.min} max={ITEM_LIMITS.max} onCommit={(depth) => onSize({ depth })} />
            </>
          )}
          <NumberField label="Height" prefix="H" value={size.height} min={0} max={ITEM_LIMITS.max} onCommit={(height) => onSize({ height })} />
        </div>
      </div>
    </>
  );
}

/** Floor, furniture, or both: wherever the object is dropped. */
export function StandsOnField({ value, onChange }: { value: StandsOn; onChange: (value: StandsOn) => void }) {
  return (
    <div>
      <span className="field-label">Stands on</span>
      <Segmented<StandsOn> label="Stands on" value={value} onChange={onChange} options={STANDS_ON_CHOICES} />
    </div>
  );
}
