import { useState } from 'react';
import { CanvasHint, CanvasStatus, CanvasToolbar, ZoomBar } from './components/CanvasOverlays';
import { ItemInspector } from './components/ItemInspector';
import { LayoutOverview } from './components/LayoutOverview';
import { LeftSidebar } from './components/LeftSidebar';
import { NewRoomDialog } from './components/NewRoomDialog';
import { TopBar } from './components/TopBar';
import { Toasts } from './components/ui/toasts';
import { RoomCanvas } from './editor/RoomCanvas';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { selectSelectedItem, useEditor } from './store';

export function App() {
  useKeyboardShortcuts();
  const selected = useEditor(selectSelectedItem);
  const [newRoomOpen, setNewRoomOpen] = useState(false);

  return (
    <div className="app">
      <TopBar onNewRoom={() => setNewRoomOpen(true)} />
      <LeftSidebar />
      <main className="canvas-area" aria-label="Room editor">
        <RoomCanvas />
        <CanvasStatus />
        <CanvasHint />
        <CanvasToolbar />
        <ZoomBar />
      </main>
      <aside className="sidebar sidebar-right" aria-label="Inspector">
        {selected ? <ItemInspector key={selected.id} item={selected} /> : <LayoutOverview />}
      </aside>
      <NewRoomDialog open={newRoomOpen} onClose={() => setNewRoomOpen(false)} />
      <Toasts />
    </div>
  );
}
