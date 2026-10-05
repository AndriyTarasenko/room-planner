import { House, ListChecks, Sofa, SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { useUi } from '../../editor/uiStore';
import { analyzeLayoutCached } from '../../furniture/analysis';
import { projectStore, selectItems, selectRooms, selectSelectedItem, selectSelectedOpening, selectSelectedRoom, useEditor } from '../../store';
import { GRID_SIZES, type GridSize, type Settings } from '../../types';
import { FurnitureBrowser } from '../catalog/FurnitureBrowser';
import { SelectionInspector } from '../Inspector';
import { FloorPlanTools } from '../LeftSidebar';
import { LayoutOverview } from '../LayoutOverview';
import { Section, Segmented, Switch } from '../ui/controls';
import { Sheet } from './Sheet';
import { type SheetId, useSheet } from './sheetStore';

const NAV: { id: SheetId; label: string; icon: ReactNode }[] = [
  { id: 'furniture', label: 'Furniture', icon: <Sofa size={20} /> },
  { id: 'plan', label: 'Floor plan', icon: <House size={20} /> },
  { id: 'overview', label: 'Overview', icon: <ListChecks size={20} /> },
  { id: 'view', label: 'View', icon: <SlidersHorizontal size={20} /> },
];

/** Sheets that step aside once something is picked or added on the plan, so it can be seen. */
const PICKERS: readonly (SheetId | null)[] = ['furniture', 'plan', 'overview'];

/**
 * The mobile layout's panels: a bottom bar that opens the furniture library, the floor plan
 * tools, the layout overview and the view settings as sheets, plus the inspector of the
 * selection, opened from its card on the canvas. The library, tools and overview are for
 * picking something, after which they close, so they cover the canvas. The view settings and
 * the inspector change what is on the plan, so the canvas makes room for them and the plan
 * stays in sight.
 */
export function MobilePanels() {
  useEffect(() => {
    const offProject = projectStore.subscribe((s, prev) => {
      if (s.selectedId === prev.selectedId) return;
      const { open, close } = useSheet.getState();
      if (s.selectedId ? PICKERS.includes(open) : open === 'details') close();
    });
    // Drawing walls and measuring happen on the canvas.
    const offUi = useUi.subscribe((s, prev) => {
      if (s.tool !== prev.tool && s.tool !== 'select') useSheet.getState().close();
    });
    return () => {
      offProject();
      offUi();
    };
  }, []);

  return (
    <>
      <div className="sheet-layer">
        <Sheet id="furniture" title="Furniture" size="tall" keepMounted>
          <FurnitureBrowser />
        </Sheet>
        <Sheet id="plan" title="Floor plan">
          <FloorPlanTools />
        </Sheet>
        <Sheet id="overview" title="Overview">
          <LayoutOverview />
        </Sheet>
      </div>
      <div className="sheet-dock">
        <Sheet id="view" title="View">
          <ViewSettings />
        </Sheet>
        <Sheet id="details" title={<DetailsTitle />}>
          <SelectionInspector />
        </Sheet>
      </div>
      <MobileNav />
    </>
  );
}

function DetailsTitle() {
  const item = useEditor(selectSelectedItem);
  const room = useEditor(selectSelectedRoom);
  const opening = useEditor(selectSelectedOpening);
  return <>{item ? 'Object' : room ? 'Room' : opening ? 'Door or window' : 'Details'}</>;
}

function MobileNav() {
  const open = useSheet((s) => s.open);
  const toggle = useSheet((s) => s.toggle);
  const items = useEditor(selectItems);
  const rooms = useEditor(selectRooms);
  const a = analyzeLayoutCached(items, rooms);
  // As many as the overview lists.
  const issues = a.collisions.length + a.clearanceConflicts.length + a.doorConflicts.length + a.wallBlockedClearanceIds.size + a.outsideIds.size;

  return (
    <nav className="mobile-nav" aria-label="Panels">
      {NAV.map((entry) => (
        <button key={entry.id} type="button" className="mobile-nav-btn" aria-expanded={open === entry.id} onClick={() => toggle(entry.id)}>
          <span className="mobile-nav-icon">{entry.icon}</span>
          <span className="mobile-nav-label">{entry.label}</span>
          {entry.id === 'overview' && issues > 0 && (
            <span className="mobile-nav-badge num" title={`${issues} issue${issues === 1 ? '' : 's'}`}>
              {issues}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

const TOGGLES: { title: string; settings: { key: keyof Settings; label: string; desc?: string }[] }[] = [
  {
    title: 'Snap to',
    settings: [
      { key: 'snapToGrid', label: 'Grid' },
      { key: 'snapToWalls', label: 'Walls' },
      { key: 'snapToFurniture', label: 'Nearby furniture' },
    ],
  },
  {
    title: 'Show',
    settings: [
      { key: 'showClearances', label: 'Clearance zones', desc: 'Space each object needs around it' },
      { key: 'showMeasurements', label: 'Distances', desc: 'From the selection to walls and furniture' },
      { key: 'constrainToRoom', label: 'Keep furniture inside rooms', desc: 'Objects stop at the walls while you drag them' },
    ],
  },
];

/** The canvas settings the desktop toolbar under the plan holds. */
function ViewSettings() {
  const settings = useEditor((s) => s.settings);
  const update = (patch: Partial<Settings>) => projectStore.getState().updateSettings(patch);

  return (
    <div>
      <Section title="Grid">
        <div className="toggle-row">
          <span>Show grid</span>
          <Switch label="Show grid" checked={settings.gridVisible} onChange={(gridVisible) => update({ gridVisible })} />
        </div>
        <div className="view-grid-size">
          <span className="field-label">Grid size</span>
          <Segmented<GridSize>
            label="Grid size"
            options={GRID_SIZES.map((g) => ({ value: g, label: `${g} cm` }))}
            value={settings.gridSize}
            onChange={(gridSize) => update({ gridSize })}
          />
        </div>
      </Section>
      {TOGGLES.map((group) => (
        <Section key={group.title} title={group.title}>
          {group.settings.map(({ key, label, desc }) => (
            <div key={key} className="toggle-row">
              <span>
                {label}
                {desc && <span className="desc">{desc}</span>}
              </span>
              <Switch label={label} checked={settings[key] as boolean} onChange={(on) => update({ [key]: on })} />
            </div>
          ))}
        </Section>
      ))}
    </div>
  );
}
