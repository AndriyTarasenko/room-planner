import { useState } from 'react';
import { AboutDialog } from './components/AboutDialog';
import { CanvasHint, CanvasStatus, CanvasToolbar, ZoomBar } from './components/CanvasOverlays';
import { ItemInspector } from './components/ItemInspector';
import { LayoutOverview } from './components/LayoutOverview';
import { LeftSidebar } from './components/LeftSidebar';
import { NewPlanDialog } from './components/NewPlanDialog';
import { OpeningInspector } from './components/OpeningInspector';
import { RoomInspector } from './components/RoomInspector';
import { TopBar } from './components/TopBar';
import { Toasts } from './components/ui/toasts';
import { RoomCanvas } from './editor/RoomCanvas';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { selectSelectedItem, selectSelectedOpening, selectSelectedOpeningRoom, selectSelectedRoom, useEditor } from './store';

export function App() {
  useKeyboardShortcuts();
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="app">
      <TopBar onNewPlan={() => setNewPlanOpen(true)} onAbout={() => setAboutOpen(true)} />
      <LeftSidebar />
      <main className="canvas-area" aria-label="Floor plan editor">
        <RoomCanvas />
        <CanvasStatus />
        <CanvasHint />
        <CanvasToolbar />
        <ZoomBar />
      </main>
      <aside className="sidebar sidebar-right" aria-label="Inspector">
        <Inspector />
      </aside>
      <NewPlanDialog open={newPlanOpen} onClose={() => setNewPlanOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <Toasts />
    </div>
  );
}

/** The right panel: whatever is selected, or the layout overview. */
function Inspector() {
  const item = useEditor(selectSelectedItem);
  const room = useEditor(selectSelectedRoom);
  const opening = useEditor(selectSelectedOpening);
  const openingRoom = useEditor(selectSelectedOpeningRoom);
  if (item) return <ItemInspector key={item.id} item={item} />;
  if (room) return <RoomInspector key={room.id} room={room} />;
  if (opening && openingRoom) return <OpeningInspector key={opening.id} opening={opening} room={openingRoom} />;
  return <LayoutOverview />;
}
