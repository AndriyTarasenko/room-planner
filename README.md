# Room Planner

A local-first browser app for quickly planning and comparing furniture layouts in a rectangular room. It is built for questions like "180 cm desk or 200 cm desk plus sideboard?" rather than for full architectural CAD.

Everything runs in the browser. There is no backend and no account; the project is saved to `localStorage` and can be exported and imported as JSON.

## Features

- **Room**: exact width and depth in centimeters. The canvas fits the room to the screen, keeps real proportions, and supports zoom (mouse wheel) and pan (drag empty space).
- **Furniture library**: desks (140/160/180/200 × 80, sit-stand, L-shaped), office chair, sofa, bed, sideboard, shelf, wardrobe, monitors (24″/27″/32″), PC tower, game console, generic box, and custom objects. Click an item to add it, or drag it onto the canvas.
- **Editing**: drag, rotate (handle, `R`, or 0/90/180/270 buttons), resize with handles or exact inspector fields. Numeric fields accept arithmetic such as `180+20`.
- **Desk shortcuts**: one-click desk widths (140/160/180/200) that keep the desk against its wall, monitor size switching, and optional desk guides (monitor area, reach zone, chair spot).
- **Monitors and other items on furniture**: dropping a monitor on a desk attaches it. It then moves and rotates with the desk and is not counted as a collision. Adding a second monitor centers the pair on the desk.
- **Measurements**: live distances from the selection to all four walls, gaps to the nearest furniture in each direction, and, for monitors, distances to the desk edges.
- **Snapping**: to walls, to nearby furniture edges and centers, and optionally to the grid (5/10/25/50 cm), with visual guides. Hold `Alt` while dragging to disable snapping.
- **Collisions**: overlapping furniture is outlined in red, the actual overlap area is shaded, and a warning appears. Overlap is never blocked. Items can opt out, for example a PC tower under a desk.
- **Clearance zones**: per-object free space on each side (front/back/left/right), such as chair roll-back or wardrobe doors. Furniture inside a zone, or a zone running into a wall, is flagged in amber. These are not counted as collisions.
- **Free floor**: the floor area not covered by furniture, shown in m² and as a percentage.
- **Layout variants**: tabs to create, duplicate, rename, delete and switch layouts. The room is shared; each layout has its own furniture.
- **Undo/redo**: covers moves, resizes, rotations, adds, deletes, property edits, layout changes, "new room" and imports.
- **Persistence**: autosaves to `localStorage`, plus JSON export and import.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Y` (`Ctrl+Shift+Z`) | Undo / redo |
| `Delete` / `Backspace` | Delete selection |
| `Escape` | Deselect |
| `R` / `Shift+R` | Rotate 90° clockwise / counter-clockwise |
| `Ctrl+D` | Duplicate |
| Arrow keys (`Shift` for 10 cm) | Nudge 1 cm |
| `Alt` while dragging | No snapping |

Shortcuts are ignored while typing in a form field or while a dialog is open.

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest unit tests (geometry, rules, store, import/export) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only |

On first launch the app creates a sample 380 × 320 cm room with a 180 × 80 cm desk, an office chair, two 27″ monitors and a sideboard. **New empty room** in the top bar starts over; it can be undone.

## Architecture

```
src/
  types/        Domain model (Room, Layout, FurnitureItem, Settings, file format)
  geometry/     Pure TypeScript: rotated rectangles, SAT collisions, polygon clipping,
                snapping, wall/neighbor distances, bounds, viewport transforms, free area
  furniture/    Preset catalog, item factory and placement, domain rules, layout analysis
  store/        Zustand store with undo/redo, pure document operations,
                persistence (localStorage) and import/export validation
  editor/       react-konva canvas: room, furniture nodes, labels, measurements,
                clearance/collision overlays, drag logic, transient UI state
  components/   Top bar, layout tabs, library, inspector, dialogs, UI primitives
  hooks/        Keyboard shortcuts, element size, commit-on-unmount for fields
  utils/        Formatting, colors, ids, number parsing, file helpers
```

### Key decisions

- **Centimeters everywhere, degrees clockwise.** Items store the *center* of their footprint (`x`, `y`), which makes rotation trivial. The inspector's X/Y show the footprint's left and top edge instead, which equals the distance to the left and top wall and is what people actually think in.
- **Geometry is independent of React.** Collision detection, snapping, distances and coordinate conversion live in `src/geometry` as pure functions with unit tests. `furniture/rules.ts` adds domain meaning on top: monitors on a desk are not a collision, and a chair may stand in a desk's seating zone.
- **One analysis pass per change.** `analyzeLayout()` computes collisions, clearance conflicts, out-of-room items and free floor space once. It is memoized on the immutable furniture array and shared by the canvas, the inspector and the status chips.
- **Snapshot undo/redo.** The undoable document is `{ room, layouts, activeLayoutId }`. Updates are immutable, so snapshots share structure and cost almost nothing. A drag, resize or rotate is one "gesture" and becomes one undo step; repeated nudges and color-picker changes merge into one step.
- **Two stores.** The persisted and undoable project lives in `store/`. Transient editor state (zoom, pan, snap guides, hover) lives in `editor/uiStore.ts`, so it never reaches history or storage.
- **Canvas coordinate systems.** Furniture is drawn in room coordinates inside a scaled Konva group, with non-scaling strokes. Labels and measurements are drawn in screen space so text stays crisp and a constant size at any zoom.
- **Defensive import.** `store/serialization.ts` validates every field, clamps values and fills defaults, so a hand-edited or older file still loads. The file carries a `format` and `version` for future migrations.
- **Plain CSS with design tokens** instead of Tailwind: one stylesheet and no build plugin. That was simpler for a small, dense tool UI.

### File format

```jsonc
{
  "format": "room-planner-project",
  "version": 1,
  "exportedAt": "2026-09-30T12:00:00.000Z",
  "room": { "id": "…", "width": 380, "depth": 320 },
  "layouts": [
    {
      "id": "…",
      "name": "Layout A",
      "furniture": [
        {
          "id": "…", "type": "desk", "name": "Desk",
          "x": 130, "y": 40,                 // center, cm from the inner top-left corner
          "width": 180, "depth": 80, "height": 75,
          "rotation": 0,                      // degrees, clockwise
          "category": "desk", "color": "#dccaa9", "notes": "",
          "placement": "floor",               // "floor" | "surface"
          "ignoreCollisions": false,
          "clearance": { "enabled": false, "front": 90, "back": 0, "left": 0, "right": 0 },
          "shape": { "kind": "rect" },        // or { "kind": "l", "segment": 60, "returnSide": "right" }
          "attachedTo": null,                 // id of the desk a monitor stands on
          "showDeskGuides": false
        }
      ]
    }
  ],
  "activeLayoutId": "…",
  "settings": { "gridVisible": true, "snapToGrid": false, "gridSize": 10, "…": "…" }
}
```

"Front" is the local +y side of an object, which faces down at rotation 0. The chair preset starts at 180° so it faces a desk placed against the top wall.

## Known limitations

- Rooms are rectangles only. There are no doors, windows, radiators or wall openings yet.
- Snapping and the "gap to neighbor" lines use axis-aligned bounding boxes. They are exact for 0/90/180/270° rotations and approximate for freely rotated items. Collisions and clearance checks always use the true rotated shape.
- Attachment is one level deep (monitor → desk). Resizing a desk leaves attached items where they are, by design.
- Free floor area is rasterized on a 2 cm grid. That is accurate to well under 1% for typical rooms, but it is an estimate.
- Undo history is kept in memory only; it is not restored after a reload. The project itself is.
- `localStorage` is per browser and per origin. Use Export JSON for backups or to move between machines.
- Desktop-first: the three-panel layout needs roughly 1100 px of width. Touch selection works in Konva, but it has not been tuned for phones.

## Adding what's out of scope later

The MVP deliberately leaves these out. This is where they would fit:

- **3D view (React Three Fiber)**: every item already has `height`, and `geometry/footprint.ts` gives the footprint polygons. A `src/viewer3d/` module could read the same store and extrude footprints, with a simple per-type mesh map, without touching the 2D editor.
- **Doors and windows**: add `openings: { wall, offset, width, swing }[]` to `Room`. Door swing arcs would become clearance-like zones fed into the existing `findClearanceConflicts`.
- **Irregular rooms**: replace `width`/`depth` with a polygon. `bounds.ts` (inside checks, clamping), wall snapping candidates and wall distances are the only room-dependent geometry; collisions and clearance already work on polygons.
- **Ergonomic scoring and viewing distance**: pure functions over `FurnitureItem[]` in `furniture/`, alongside `analysis.ts`. For example, eye-to-monitor distance could use the chair spot from `chairSpotForDesk`. Results can be rendered as another overlay, like `DeskGuides`.
- **Walking-path analysis**: rasterize the free floor (already done in `geometry/area.ts`), then run a distance transform or BFS to find narrow passages and the minimum corridor width between the door and key furniture.
- **Automatic layout generation**: a search over positions and rotations scored by collisions, clearances and ergonomics, all of which already exist as pure functions. It could run in a Web Worker and write results as new layout variants.
- **Real product dimensions / IKEA presets**: presets are plain data (`furniture/presets.ts`). A catalog could be a JSON file or an importable preset pack, with no code changes to the editor.
- **Cable planning**: add point features (sockets, desk grommets) and polylines as a new item kind; the store's document model and history already handle arbitrary layout data.
- **Image/PDF export**: `stage.toDataURL()` on the Konva stage gives a PNG of the current view in a few lines.
