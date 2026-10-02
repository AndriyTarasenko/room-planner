import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { type Issue, analyzeLayoutCached, doorName } from '../furniture/analysis';
import { useCollapsedGroups } from '../hooks/useCollapsedGroups';
import { roomArea, roomRect } from '../plan/shape';
import type { Room } from '../types';
import { projectStore, selectActiveLayout, selectRooms, useEditor } from '../store';
import type { FurnitureItem } from '../types';
import { isCircle } from '../geometry/footprint';
import { formatArea, formatFootprint, formatPercent, formatSize } from '../utils/format';
import { IssueList } from './ItemInspector';
import { ROOM_ICON } from './planIcons';
import { Section } from './ui/controls';

/** Which overview sections are folded, remembered in this browser. */
const OVERVIEW_COLLAPSED_KEY = 'room-planner:overview-collapsed';

/** "380 × 320" for a rectangular room; other shapes are described by their area alone. */
function roomSize(room: Room): string {
  const rect = roomRect(room);
  return rect ? formatSize(rect.width, rect.depth) : '';
}

/** Right panel when nothing is selected: summary, rooms, issues and the object list. */
export function LayoutOverview() {
  const layout = useEditor(selectActiveLayout);
  const rooms = useEditor(selectRooms);
  const items = layout.furniture;
  const analysis = analyzeLayoutCached(items, rooms);
  const select = (id: string) => projectStore.getState().select(id);
  const { collapsed, toggle } = useCollapsedGroups(OVERVIEW_COLLAPSED_KEY);
  // A folded section shows how many entries it hides instead of its usual note.
  const folding = (id: string, count: number, aside?: ReactNode) => ({
    collapsed: collapsed.has(id),
    onToggle: () => toggle(id),
    aside: collapsed.has(id) ? <span className="section-hint num">{count}</span> : aside,
  });

  const byId = new Map(items.map((i) => [i.id, i]));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const name = (id: string) => byId.get(id)?.name || 'Object';
  // One entry per problem, phrased from the layout's point of view.
  const described: Issue[] = [
    ...analysis.collisions.map((c): Issue => ({ kind: 'collision', itemId: c.a, otherId: c.b, message: `${name(c.a)} overlaps ${name(c.b)}` })),
    ...analysis.clearanceConflicts.map(
      (c): Issue => ({
        kind: 'clearance',
        itemId: c.intruderId,
        otherId: c.ownerId,
        message: `${name(c.intruderId)} is in the clearance of ${name(c.ownerId)}`,
      }),
    ),
    ...analysis.doorConflicts.map((c): Issue => {
      const room = roomById.get(c.roomId);
      return { kind: 'clearance', itemId: c.itemId, message: `${name(c.itemId)} blocks ${room ? doorName(room) : 'a door'}` };
    }),
    ...[...analysis.wallBlockedClearanceIds].map(
      (id): Issue => ({ kind: 'clearance', itemId: id, message: `The clearance of ${name(id)} runs into a wall` }),
    ),
    ...[...analysis.outsideIds].map(
      (id): Issue => ({ kind: 'outside', itemId: id, message: `${name(id)} is ${rooms.length === 1 ? 'outside the room' : 'not fully inside a room'}` }),
    ),
  ];

  const topLevel = items.filter((i) => !i.attachedTo || !byId.has(i.attachedTo));
  const childrenOf = (id: string) => items.filter((i) => i.attachedTo === id);

  return (
    <div>
      <Section title={layout.name} aside={<span className="section-hint num">{items.length} objects</span>}>
        <div className="stat-grid">
          {rooms.length === 1 ? (
            <div>
              <span className="stat-label">Room</span>
              <span className="stat-value">{roomRect(rooms[0]) ? `${roomSize(rooms[0])} cm` : `${rooms[0].corners.length} walls`}</span>
            </div>
          ) : (
            <div>
              <span className="stat-label">Rooms</span>
              <span className="stat-value">{rooms.length}</span>
            </div>
          )}
          <div>
            <span className="stat-label">Floor area</span>
            <span className="stat-value">{formatArea(analysis.usage.total)}</span>
          </div>
          <div>
            <span className="stat-label">Free floor</span>
            <span className="stat-value">{formatArea(analysis.usage.free)}</span>
          </div>
          <div>
            <span className="stat-label">Free share</span>
            <span className="stat-value">{formatPercent(analysis.usage.ratio)}</span>
          </div>
        </div>
      </Section>

      <Section title="Rooms" {...folding('rooms', rooms.length, <span className="section-hint">click to edit</span>)}>
        <div className="object-list">
          {rooms.map((room) => {
            const usage = analysis.roomUsage.get(room.id);
            return (
              <button key={room.id} type="button" className="object-row" onClick={() => select(room.id)}>
                <span className="object-row-icon">{ROOM_ICON}</span>
                <span className="name">{room.name}</span>
                <span className="size" title={usage ? `${formatPercent(usage.ratio)} of the floor is free` : undefined}>
                  {roomRect(room) ? `${roomSize(room)} · ` : ''}
                  {formatArea(roomArea(room))}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Issues" {...folding('issues', described.length)}>
        {described.length > 0 ? (
          <IssueList issues={described} onSelect={(issue) => select(issue.itemId)} />
        ) : (
          <div className="row muted" style={{ fontSize: 12 }}>
            <CircleCheck size={14} />
            No overlaps or blocked clearances
          </div>
        )}
      </Section>

      <Section title="Objects" {...folding('objects', items.length)}>
        {items.length === 0 ? (
          <p className="empty-note" style={{ margin: 0 }}>
            This layout is empty. Add furniture from the library on the left.
          </p>
        ) : (
          <div className="object-list">
            {topLevel.map((item) => (
              <div key={item.id}>
                <ObjectRow item={item} flagged={analysis.collidingIds.has(item.id) || analysis.outsideIds.has(item.id)} onSelect={select} />
                {childrenOf(item.id).map((child) => (
                  <ObjectRow key={child.id} item={child} child flagged={analysis.collidingIds.has(child.id)} onSelect={select} />
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function ObjectRow({ item, child, flagged, onSelect }: { item: FurnitureItem; child?: boolean; flagged: boolean; onSelect: (id: string) => void }) {
  return (
    <button type="button" className={`object-row${child ? ' child' : ''}`} onClick={() => onSelect(item.id)}>
      <span className="swatch" style={{ background: item.color, width: 12, height: 12 }} />
      <span className="name">{item.name}</span>
      {flagged && <span className="flag" style={{ background: 'var(--danger)' }} title="Has a problem" />}
      <span className="size">{formatFootprint(item.width, item.depth, isCircle(item))}</span>
    </button>
  );
}
