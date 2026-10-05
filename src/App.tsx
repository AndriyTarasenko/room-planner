import { useLayoutEffect, useState } from 'react';
import { AboutDialog } from './components/AboutDialog';
import { CanvasHint, CanvasStatus, CanvasToolbar, ShortcutsPanel, ZoomBar } from './components/CanvasOverlays';
import { Inspector } from './components/Inspector';
import { LeftSidebar } from './components/LeftSidebar';
import { CanvasCard } from './components/mobile/CanvasCard';
import { MobilePanels } from './components/mobile/MobilePanels';
import { NewPlanDialog } from './components/NewPlanDialog';
import { TopBar } from './components/TopBar';
import { Toasts } from './components/ui/toasts';
import { RoomCanvas } from './editor/RoomCanvas';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMobileLayout } from './hooks/useMediaQuery';

export function App() {
  useKeyboardShortcuts();
  const mobile = useMobileLayout();
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // On <html>, so the mobile styles reach menus and dialogs outside the app too.
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-mobile', mobile);
  }, [mobile]);

  return (
    <div className="app">
      <TopBar onNewPlan={() => setNewPlanOpen(true)} onAbout={() => setAboutOpen(true)} mobile={mobile} />
      {!mobile && <LeftSidebar />}
      <main className="canvas-area" aria-label="Floor plan editor">
        <RoomCanvas />
        <CanvasStatus />
        {mobile ? (
          <>
            <ZoomBar compact />
            <CanvasCard />
          </>
        ) : (
          <>
            <CanvasHint />
            {/* Before the toolbars, so their tooltips show on top of it. */}
            <ShortcutsPanel />
            <CanvasToolbar />
            <ZoomBar />
          </>
        )}
      </main>
      {mobile ? (
        <MobilePanels />
      ) : (
        <aside className="sidebar sidebar-right" aria-label="Inspector">
          <Inspector />
        </aside>
      )}
      <NewPlanDialog open={newPlanOpen} onClose={() => setNewPlanOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <Toasts />
    </div>
  );
}
