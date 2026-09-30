import { Plus, Search } from 'lucide-react';
import { type DragEvent, useMemo, useState } from 'react';
import { PRESET_DRAG_TYPE } from '../editor/RoomCanvas';
import { CATEGORIES } from '../furniture/categories';
import { type FurniturePreset, LIBRARY_GROUPS, PRESETS } from '../furniture/presets';
import { projectStore, useEditor } from '../store';
import { ROOM_LIMITS } from '../store/defaults';
import { shade } from '../utils/color';
import { formatArea, formatSize } from '../utils/format';
import { CustomFurnitureDialog } from './CustomFurnitureDialog';
import { NumberField } from './ui/NumberField';
import { Section } from './ui/controls';

export function LeftSidebar() {
  return (
    <aside className="sidebar sidebar-left" aria-label="Room and furniture library">
      <RoomSettings />
      <FurnitureLibrary />
    </aside>
  );
}

function RoomSettings() {
  const room = useEditor((s) => s.room);
  const { setRoomSize } = projectStore.getState();
  return (
    <Section title="Room" aside={<span className="section-hint num">{formatArea(room.width * room.depth)}</span>}>
      <div className="grid-2">
        <div>
          <span className="field-label">Width</span>
          <NumberField
            label="Room width"
            value={room.width}
            suffix="cm"
            min={ROOM_LIMITS.min}
            max={ROOM_LIMITS.max}
            onCommit={(width) => setRoomSize({ width })}
          />
        </div>
        <div>
          <span className="field-label">Depth</span>
          <NumberField
            label="Room depth"
            value={room.depth}
            suffix="cm"
            min={ROOM_LIMITS.min}
            max={ROOM_LIMITS.max}
            onCommit={(depth) => setRoomSize({ depth })}
          />
        </div>
      </div>
    </Section>
  );
}

/** Proportional footprint thumbnail for a preset. */
function PresetGlyph({ preset }: { preset: FurniturePreset }) {
  const box = 16;
  const ratio = preset.width / preset.depth;
  const w = ratio >= 1 ? box : Math.max(4, box * ratio);
  const h = ratio >= 1 ? Math.max(4, box / ratio) : box;
  const x = (box - w) / 2 + 0.5;
  const y = (box - h) / 2 + 0.5;
  const color = CATEGORIES[preset.category].color;
  const stroke = shade(color, 0.4);
  if (preset.shape?.kind === 'l') {
    const s = h * (preset.shape.segment / preset.depth);
    const points = `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x + w - s},${y + h} ${x + w - s},${y + s} ${x},${y + s}`;
    return (
      <svg width={17} height={17} aria-hidden="true">
        <polygon points={points} fill={color} stroke={stroke} strokeWidth={1} />
      </svg>
    );
  }
  const radius = preset.type === 'office-chair' ? 4 : 1;
  return (
    <svg width={17} height={17} aria-hidden="true">
      <rect x={x} y={y} width={w - 1} height={h - 1} rx={radius} fill={color} stroke={stroke} strokeWidth={1} />
    </svg>
  );
}

function FurnitureLibrary() {
  const [query, setQuery] = useState('');
  const [customOpen, setCustomOpen] = useState(false);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (p: FurniturePreset) =>
      !q || `${p.label} ${p.group} ${formatSize(p.width, p.depth)} ${p.width}x${p.depth}`.toLowerCase().includes(q);
    return LIBRARY_GROUPS.map((group) => ({ group, presets: PRESETS.filter((p) => p.group === group && matches(p)) })).filter(
      (g) => g.presets.length > 0,
    );
  }, [query]);

  const onDragStart = (e: DragEvent<HTMLButtonElement>, preset: FurniturePreset) => {
    e.dataTransfer.setData(PRESET_DRAG_TYPE, preset.id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <>
      <div className="section library">
        <div className="section-header">
          <h3 className="section-title" style={{ margin: 0 }}>
            Furniture
          </h3>
          <span className="section-hint">Click or drag to add</span>
        </div>
        <label className="input library-search">
          <Search size={13} style={{ color: 'var(--text-3)', marginRight: 6, flexShrink: 0 }} />
          <input type="search" placeholder="Search furniture" aria-label="Search furniture" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {groups.map(({ group, presets }) => (
          <div className="library-group" key={group}>
            <div className="library-group-title">{group}</div>
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="library-item"
                draggable
                onDragStart={(e) => onDragStart(e, preset)}
                onClick={() => projectStore.getState().addPreset(preset.id)}
                title={`Add ${preset.label} (${formatSize(preset.width, preset.depth)} cm)`}
              >
                <PresetGlyph preset={preset} />
                <span className="library-item-name">{preset.label}</span>
                <span className="library-item-size">{formatSize(preset.width, preset.depth)}</span>
                <Plus size={14} className="library-item-add" />
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className="empty-note">No furniture matches “{query}”.</p>}
      </div>
      <div className="library-footer">
        <button type="button" className="btn btn-secondary btn-block" onClick={() => setCustomOpen(true)}>
          <Plus size={15} />
          Custom object
        </button>
      </div>
      <CustomFurnitureDialog open={customOpen} onClose={() => setCustomOpen(false)} />
    </>
  );
}
