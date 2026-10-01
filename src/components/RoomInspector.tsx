import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useUi } from '../editor/uiStore';
import { analyzeLayoutCached } from '../furniture/analysis';
import { OPENING_DEFAULTS } from '../plan/openings';
import { itemIdsInRoom } from '../plan/rooms';
import { MIN_WALL_LENGTH, roomArea, roomBounds, roomRect } from '../plan/shape';
import { WALL_LIMITS, wallFrame, wallNames } from '../plan/walls';
import { projectStore, selectItems, useEditor } from '../store';
import { ROOM_LIMITS } from '../store/defaults';
import type { OpeningKind, Room } from '../types';
import { formatArea, formatNumber, formatPercent, formatSize } from '../utils/format';
import { OPENING_ICONS } from './planIcons';
import { deleteRoom } from './projectActions';
import { toast } from './ui/toastStore';
import { NumberField } from './ui/NumberField';
import { Section, Switch, TextField } from './ui/controls';

/** Properties of the selected room: name, size, position, walls and its doors and windows. */
export function RoomInspector({ room }: { room: Room }) {
  const rooms = useEditor((s) => s.rooms);
  const items = useEditor(selectItems);
  const analysis = analyzeLayoutCached(items, rooms);
  const usage = analysis.roomUsage.get(room.id);
  const objectCount = itemIdsInRoom(items, room).size;
  const canDelete = rooms.length > 1;
  const { renameRoom, setRoomGeometry } = projectStore.getState();
  const rect = roomRect(room);
  const bounds = roomBounds(room);

  return (
    <div>
      <div className="inspector-head">
        <TextField className="name-input" label="Room name" value={room.name} maxLength={80} onCommit={(name) => renameRoom(room.id, name)} />
        <div className="inspector-meta">
          <span>{rect ? 'Room' : `Room · ${room.corners.length} walls`}</span>
          <span aria-hidden="true">·</span>
          <span className="num">{formatArea(roomArea(room))}</span>
          <span aria-hidden="true">·</span>
          <span>
            {objectCount} object{objectCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="inspector-actions">
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="icon-btn danger"
            data-tip={canDelete ? 'Delete room and its furniture (Del)' : 'The only room can’t be deleted'}
            aria-label="Delete room"
            disabled={!canDelete}
            onClick={() => deleteRoom(room.id)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <Section title="Size" aside={<span className="section-hint">cm, inside the walls</span>}>
        {rect ? (
          <div className="grid-2">
            <NumberField label="Room width" prefix="W" value={rect.width} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onCommit={(width) => setRoomGeometry(room.id, { width })} />
            <NumberField label="Room depth" prefix="D" value={rect.depth} min={ROOM_LIMITS.min} max={ROOM_LIMITS.max} onCommit={(depth) => setRoomGeometry(room.id, { depth })} />
          </div>
        ) : (
          <div className="stat-grid">
            <div>
              <span className="stat-label">Overall</span>
              <span className="stat-value">{formatSize(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)}</span>
            </div>
            <div>
              <span className="stat-label">Floor area</span>
              <span className="stat-value">{formatArea(roomArea(room))}</span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Position" aside={<span className="section-hint">{rect ? 'inner top-left corner' : 'top-left of the floor'}</span>}>
        <div className="grid-2">
          <NumberField label="Room X position" prefix="X" value={bounds.minX} onCommit={(x) => setRoomGeometry(room.id, { x }, { carry: true })} />
          <NumberField label="Room Y position" prefix="Y" value={bounds.minY} onCommit={(y) => setRoomGeometry(room.id, { y }, { carry: true })} />
        </div>
        <p className="field-note">Drag the name tag on the plan to move the room. Furniture moves with it.</p>
      </Section>

      <WallsSection room={room} />
      <OpeningsSection room={room} />

      {usage && (
        <Section title="Floor">
          <div className="stat-grid">
            <div>
              <span className="stat-label">Free floor</span>
              <span className="stat-value">{formatArea(usage.free)}</span>
            </div>
            <div>
              <span className="stat-label">Free share</span>
              <span className="stat-value">{formatPercent(usage.ratio)}</span>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

function WallsSection({ room }: { room: Room }) {
  const { setWall, setRoomWallLength, splitRoomWall } = projectStore.getState();
  const { setHoveredWall } = useUi.getState();
  const names = wallNames(room);
  // Don't leave a wall highlighted when the inspector goes away.
  useEffect(() => () => useUi.getState().setHoveredWall(null), []);
  const addCorner = (wall: number) => {
    const length = wallFrame(room, wall).length;
    if (splitRoomWall(room.id, wall, Math.round(length / 2)) === null) toast('This wall is too short to add a corner.', 'error');
  };
  return (
    <Section title="Walls" aside={<span className="section-hint">length · thickness, cm</span>}>
      <div className="wall-rows" onMouseLeave={() => setHoveredWall(null)}>
        {room.walls.map((wall, i) => {
          const solid = wall.kind === 'wall';
          const name = names[i];
          const length = wallFrame(room, i).length;
          return (
            <div key={i} className="wall-row" onMouseEnter={() => setHoveredWall({ roomId: room.id, wall: i })}>
              <Switch label={`${name} wall`} checked={solid} onChange={(on) => setWall(room.id, i, { kind: on ? 'wall' : 'open' })} />
              <span className="wall-row-side" title={name}>
                {name}
              </span>
              <NumberField
                label={`${name} wall length`}
                value={Math.round(length * 10) / 10}
                min={MIN_WALL_LENGTH}
                max={ROOM_LIMITS.max}
                onCommit={(v) => setRoomWallLength(room.id, i, v)}
              />
              {solid ? (
                <NumberField
                  label={`${name} wall thickness`}
                  value={wall.thickness}
                  min={WALL_LIMITS.min}
                  max={WALL_LIMITS.max}
                  onCommit={(thickness) => setWall(room.id, i, { thickness })}
                />
              ) : (
                <span className="wall-row-open">Open</span>
              )}
              <button type="button" className="icon-btn icon-btn-sm" data-tip="Add a corner in the middle" aria-label={`Add a corner in the middle of the ${name} wall`} onClick={() => addCorner(i)}>
                <Plus size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="field-note">
        On the plan, drag a wall or corner to reshape the room. Double-click a wall to add a corner there, or a corner to remove it. A wall that is switched off leaves the side open, for a balcony or an open-plan space.
      </p>
    </Section>
  );
}

function OpeningsSection({ room }: { room: Room }) {
  const { addOpening, select } = projectStore.getState();
  const add = (kind: OpeningKind) => addOpening(kind, { roomId: room.id });
  const names = wallNames(room);
  return (
    <Section title="Doors & windows" aside={<span className="section-hint num">{room.openings.length || ''}</span>}>
      {room.openings.length > 0 ? (
        <div className="object-list">
          {room.openings.map((o) => (
            <button key={o.id} type="button" className="object-row" onClick={() => select(o.id)}>
              <span className="object-row-icon">{OPENING_ICONS[o.kind]}</span>
              <span className="name">{OPENING_DEFAULTS[o.kind].label}</span>
              <span className="size">
                {names[o.wall]} wall · {formatNumber(o.width)} cm
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-note" style={{ margin: 0 }}>
          No doors or windows yet. Add them here, or drag them from the left onto a wall.
        </p>
      )}
      <div className="add-row">
        {(['door', 'window', 'passage'] as const).map((kind) => (
          <button key={kind} type="button" className="btn btn-secondary btn-sm" onClick={() => add(kind)}>
            {OPENING_ICONS[kind]}
            {OPENING_DEFAULTS[kind].label}
          </button>
        ))}
      </div>
    </Section>
  );
}
