import { Fragment, type ReactNode } from 'react';
import { startDrawing, stopDrawing } from '../editor/drawTool';
import { type PlanTool, addPlanElement, startPlanDrag } from '../editor/planTools';
import { toggleMeasuring } from '../editor/rulerTool';
import { useUi } from '../editor/uiStore';
import { roomArea } from '../plan/shape';
import { useEditor } from '../store';
import { formatArea } from '../utils/format';
import { FurnitureBrowser } from './catalog/FurnitureBrowser';
import { DRAW_ICON, MEASURE_ICON, OPENING_ICONS, ROOM_ICON } from './planIcons';
import { Section } from './ui/controls';

export function LeftSidebar() {
  return (
    <aside className="sidebar sidebar-left" aria-label="Floor plan and furniture library">
      <FloorPlanTools />
      <FurnitureBrowser />
    </aside>
  );
}

const TOOLS: { tool: PlanTool; label: string; icon: ReactNode; title: string }[] = [
  { tool: 'room', label: 'Room', icon: ROOM_ICON, title: 'Add a rectangular room next to the plan, or drag it to where it goes' },
  { tool: 'door', label: 'Door', icon: OPENING_ICONS.door, title: 'Add a door to the current room, or drag it onto a wall' },
  { tool: 'window', label: 'Window', icon: OPENING_ICONS.window, title: 'Add a window to the current room, or drag it onto a wall' },
  { tool: 'passage', label: 'Passage', icon: OPENING_ICONS.passage, title: 'Add an opening without a door, or drag it onto a wall' },
];

function FloorPlanTools() {
  const rooms = useEditor((s) => s.rooms);
  const tool = useUi((s) => s.tool);
  const drawing = tool === 'draw';
  const measuring = tool === 'measure';
  const area = rooms.reduce((sum, r) => sum + roomArea(r), 0);
  return (
    <Section
      title="Floor plan"
      aside={
        <span className="section-hint num">
          {rooms.length} room{rooms.length === 1 ? '' : 's'} · {formatArea(area)}
        </span>
      }
    >
      <div className="plan-tools">
        {TOOLS.map((t) => (
          <Fragment key={t.tool}>
            <button
              type="button"
              className="plan-tool"
              title={t.title}
              draggable
              onDragStart={(e) => startPlanDrag(e, t.tool)}
              onClick={() => {
                stopDrawing();
                addPlanElement(t.tool);
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
            {t.tool === 'room' && (
              <>
                <button
                  type="button"
                  className="plan-tool"
                  aria-pressed={drawing}
                  title="Draw a room of any shape, wall by wall: click each corner, then the first corner again (or press Enter)"
                  onClick={() => (drawing ? stopDrawing() : startDrawing())}
                >
                  {DRAW_ICON}
                  <span>Draw walls</span>
                </button>
                <button
                  type="button"
                  className="plan-tool"
                  aria-pressed={measuring}
                  title="Measure the distance between any two points (M)"
                  onClick={toggleMeasuring}
                >
                  {MEASURE_ICON}
                  <span>Measure</span>
                </button>
              </>
            )}
          </Fragment>
        ))}
      </div>
      <p className="field-note">
        {drawing
          ? 'Click to place each corner. Click the first corner or press Enter to finish; type a number for an exact wall length.'
          : measuring
            ? 'Drag between two points, or click both ends. Ends snap to corners, walls and furniture; hold Alt to place them freely.'
            : 'Draw walls for a room of any shape. Click a room, door or window on the plan to change it.'}
      </p>
    </Section>
  );
}
