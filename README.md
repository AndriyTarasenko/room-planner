# Room Planner

A local-first browser app for quickly planning and comparing furniture layouts in a room or a whole apartment. It is built for questions like "180 cm desk or 200 cm desk plus sideboard?" rather than for full architectural CAD.

Everything runs in the browser. There is no backend and no account; the project is saved to `localStorage` and can be exported and imported as JSON.

## Features

- **Floor plan**: one room or a whole apartment, with exact interior sizes in centimeters. **Room** under *Floor plan* adds a rectangular room: it docks to the right of the plan, sharing a wall, or goes wherever you drag it. Click a room to select it, then drag its name tag to move it (its furniture moves along, in every layout on that floor plan). Rooms snap together so neighbors share one wall. The canvas fits the plan to the screen, keeps real proportions, and supports zoom (mouse wheel) and pan (drag the floor or empty space).
- **Rooms of any shape**: **Draw walls** draws a room wall by wall. Click to place each corner and click the first corner again (or press `Enter`, or double-click the last corner) to close it. Walls snap to horizontal, vertical and 45°, corners snap onto the corners of existing rooms so the new room can share their walls, and typing a number while drawing gives the next wall that exact length. Any room can also be reshaped: drag a wall to move it (the walls next to it keep their direction, so corners stay square), drag a corner anywhere for a slanted wall, double-click a wall to add a corner, and double-click a corner to remove it. Moving part of a split wall adds the short walls on either side, so a niche, a bay or a chimney breast takes two double-clicks and a drag. The inspector lists every wall with its length, which you can type in exactly.
- **Walls**: each wall has its own thickness (12 cm by default, drawn outside the interior so interior sizes stay exact), or no wall at all. Walls meet in clean mitered corners at any angle. Switch off the outer wall of a balcony for its open side, or the walls between two rooms to join them into one open-plan space. Furniture can span such a seam.
- **Doors, windows and passages**: click **Door**, **Window** or **Passage** to add one to the current room, or drag it onto a wall, slanted walls included. Drag it along the wall and around corners, or set its width and distance from either corner in the inspector. Doors have a hinge side and open into the room or outward. A door between two rooms cuts through the wall they share.
- **Furniture catalog**: generic furniture in typical sizes, 69 real IKEA products with verified dimensions, optional IKEA online search, and your own saved products. Search, filter by manufacturer and category, keep favorites, and find the last 8 items you used. Categories fold away with a click on their title (or all at once), and this browser remembers which ones are folded. Click an item to add it, or drag it onto the canvas. See [Furniture catalog](#furniture-catalog).
- **Editing**: drag, rotate, resize with handles or exact inspector fields. The round handle above the selection turns an object to any angle in whole degrees and shows the angle while you turn. It sticks to the diagonals and to the walls of the object's room, so furniture lines up with a slanted wall. Hold `Shift` for 15° steps or `Alt` to turn without sticking. `R` turns by 90°, `[` and `]` by 15°, and the inspector has 0/90/180/270 buttons and an angle field. Numeric fields accept arithmetic such as `180+20`. L-shaped sofas, desks and counters have a handle on each arm: drag an arm's end to change its length, or its inner edge to change its depth, so both parts of the L are sized separately.
- **Round furniture**: round and oval tables, poufs, stools and plants. A circle is sized by its diameter (Ø) and stays a circle when you drag either handle. Tables, poufs, plants and plain objects can be switched between **Rectangle**, **Round** and **Oval** in the inspector. Collisions, clearance checks and "inside the room" use the round outline, so a chair in the corner of a round table's bounding box isn't a collision.
- **Desk shortcuts**: one-click desk widths (140/160/180/200) that keep the desk against its wall, monitor and TV size switching, and optional desk guides (monitor area, reach zone, chair spot).
- **Monitors and other items on furniture**: dropping a monitor on a desk attaches it. It then moves and rotates with the desk and is not counted as a collision. Adding a second monitor centers the pair on the desk. A new TV goes onto a TV bench, and a microwave or kitchen wall cabinet onto a kitchen counter. Objects set to stand on **Both** (the small plant, or any custom object) go wherever you drop them: onto a desk, table or shelf, or onto the floor, and they switch between the two as you drag them on and off.
- **Measurements**: live distances from the selection to the nearest wall of its room in each direction, gaps to the nearest furniture in each direction, and, for monitors, distances to the desk edges. A selected door or window shows its distance to both corners of the wall.
- **Ruler**: **Measure** under *Floor plan* (or `M`) measures the distance between any two points. Drag from one point to the other, or click both ends. The ends snap to the corners of rooms, walls, doors, windows and furniture, to the centers of round furniture, and onto wall faces and furniture outlines. Near horizontal or vertical, the measurement locks to that axis and stops on a wall or furniture edge it crosses. A slanted measurement also shows its horizontal and vertical parts. Hold `Alt` to place the ends freely. While measuring, the middle mouse button pans, and `Escape` removes the measurement, then leaves the tool.
- **Snapping**: to walls, to nearby furniture edges and centers, and optionally to the grid (5/10/25/50 cm, measured from the room's corner), with visual guides. Hold `Alt` while dragging to disable snapping.
- **Collisions**: overlapping furniture is outlined in red, the actual overlap area is shaded, and a warning appears. Overlap is never blocked. Items can opt out, for example a PC tower under a desk.
- **Clearance zones**: per-object free space on each side (front/back/left/right), such as chair roll-back or wardrobe doors. Furniture inside a zone, or a zone running into a wall, is flagged in amber. These are not counted as collisions.
- **Door swings**: furniture standing where a door opens is flagged in amber, with the blocked door named in the issue list.
- **Keeping furniture in its room**: with *Inside rooms* on, furniture stays inside the room it is in. Dragged far enough through a wall, it moves into the next room.
- **Free floor**: the floor area not covered by furniture, per room and for the whole plan, in m² and as a percentage.
- **Layout overview**: with nothing selected, the right panel sums up the layout and lists its rooms, issues and objects. Each list folds away with a click on its title and then shows how many entries it holds. This browser remembers which lists are folded.
- **Layout variants**: tabs to create, duplicate, rename, delete and switch layouts. Each layout has its own furniture. New and duplicated layouts share the floor plan (rooms, walls, doors, windows) of the layout they came from, so a wall fixed once is fixed in all of them. While a layout shares its floor plan, *Floor plan shared with …* shows under the Floor plan tools and in the room, door and window inspectors. Its **Unlink** button (or **Unlink floor plan** in the tab's ⋯ menu) gives the layout its own copy, so you can compare a knocked-out wall or a moved door without touching the other layouts. **Duplicate with its own floor plan** in the + and ⋯ menus does both in one step.
- **Undo/redo**: covers moves, resizes, rotations, adds, deletes, property edits, room, wall, door and window changes, layout changes, "new plan" and imports.
- **Persistence**: autosaves to `localStorage`, plus JSON export and import.
- **Phones and tablets**: below 900 px of width (or on a touch screen held sideways), the side panels give way to a bottom bar. *Furniture*, *Floor plan* and *Overview* open as sheets over the plan and close once you pick something. *View* (grid, snapping, clearances, distances) and the selection's properties open below the plan, which shrinks to stay in sight; with the phone held sideways they open beside it. Tapping an object shows a card with rotate, duplicate, delete and deselect; tap the card for all its properties. Two fingers pinch to zoom and pan, handles are larger, and a double tap adds or removes a room corner. Drawing walls and measuring get *Finish*, *Undo* and *Done* buttons, since a phone has no `Enter` or `Escape`.

### Keyboard shortcuts

The most used ones are listed in a panel at the bottom right of the canvas. `?` or the keyboard button next to the zoom hides and shows it, and this browser remembers your choice.

| Keys | Action |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Y` (`Ctrl+Shift+Z`) | Undo / redo |
| `Delete` / `Backspace` | Delete the selected object, door, window or room (a room takes its furniture with it) |
| `Escape` | Deselect |
| `R` / `Shift+R` | Rotate 90° clockwise / counter-clockwise |
| `]` / `[` (`Shift` for 1°) | Rotate 15° clockwise / counter-clockwise. An object at an odd angle turns to the next multiple of 15° first |
| `Ctrl+D` | Duplicate |
| `M` | Ruler: measure between two points (`M` again to stop) |
| Arrow keys (`Shift` for 10 cm) | Nudge 1 cm. A room moves with its furniture; a door or window slides along its wall |
| `Alt` while dragging | No snapping (on the rotate handle: no sticking to diagonals and walls) |
| `Shift` on the rotate handle | Turn in 15° steps |
| `?` | Show or hide the shortcuts panel |

While drawing walls:

| Keys | Action |
| --- | --- |
| Digits, then `Enter` | Place the next corner that many centimeters away, in the direction of the pointer (arithmetic such as `250+12` works) |
| `Enter` | Close the room |
| `Backspace` / `Ctrl+Z` | Take back the last corner (or the last typed digit) |
| `Escape` | Clear the typed length, or stop drawing |
| `Alt` | No snapping, only whole centimeters |

Shortcuts are ignored while typing in a form field or while a dialog is open.

## Furniture catalog

The furniture browser in the left sidebar combines four sources:

- **Generic furniture**: typical sizes, always available offline.
  - Living and sleeping: desks (plain, sit-stand, L-shaped), office and dining chairs, armchair, pouf, stool and bar stool, 2- and 3-seat sofas, sofa with chaise longue, L-shaped corner sofa, beds 90/140/160/180 × 200, coffee, side and dining tables (120/160/200), round dining tables (Ø 90, Ø 120), an oval dining table (180 × 100), round coffee and side tables, sideboard, TV bench, chest of drawers, nightstand, shoe cabinet, shelf and wardrobes (100/150/200).
  - Kitchen: base cabinet, straight and L-shaped counters, island, tall and wall cabinets, sink cabinet, stove, fridge-freezer, side-by-side fridge, dishwasher and microwave.
  - Bathroom: toilet, washbasin, vanity unit, showers (90 × 90, 120 × 80), bathtub, washing machine and tumble dryer.
  - Electronics: TVs (43″–75″, on their stand), monitors, PC tower and game console.
  - Other: a floor plant, a small plant for furniture or the floor, and a plain rectangle and circle for anything else.

  Each kind has its own top-down symbol (sink basin, burners, toilet bowl, washer drum…). Appliances with doors and toilets come with clearance zones switched on.
- **Curated manufacturer products**: 69 IKEA products for home offices, gaming rooms, bedrooms and living rooms. They include ALEX, MALM, MICKE, LAGKAPTEN, IDÅSEN, TROTTEN, MITTZON and UTESPELARE desks, MARKUS, FLINTAN, MATCHSPEL and STYRSPEL chairs, BILLY, KALLAX, PAX, KLEPPSTAD, BRIMNES, SONGESAND and HEMNES storage, MALM, SLATTUM and HEMNES beds, KIVIK, EKTORP, KLIPPAN and GLOSTAD sofas, and BESTÅ and LACK TV furniture and tables. Every size variant is its own entry with its own article number, and every dimension was checked against the IKEA Germany product page (catalog 1.2, 2026-10-01).
- **My furniture**: products you saved, either from IKEA online search or as custom objects ("Save to My furniture for reuse"). They are kept in this browser. The pencil on a saved row, or **Edit** in its details, changes its name, shape, size, category and what it stands on. If copies are already placed in the project, the edit can update them in every layout, as one undo step. Only what you changed is applied, so a copy you renamed keeps its name.
- **Live providers**: "Search IKEA online" looks up IKEA's current range. It is optional; see below.

Search is case- and accent-insensitive (`idasen` finds IDÅSEN) and matches name, product line, type, manufacturer, category, article number (`004.735.46` or `00473546`) and sizes (`160x80`, or a bed's `160x200`). Rows show manufacturer, name and width × depth × height; ⓘ opens the details (article number, category, source, verification date and product page). Favorites (☆) and the 8 most recently used items are stored in this browser.

Custom objects work as before: name, shape (rectangle, round or oval), width and depth or a diameter, height, category and whether it stands on the floor, on furniture, or both. A custom object behaves like any catalog object once placed.

### IKEA integration

- **The built-in catalog works on its own.** Curated IKEA products are part of the app and need no network.
- **IKEA online search uses an unofficial interface.** It calls the same public search service that ikea.com uses (`sik.search.blue.cdtapps.com`, IKEA Germany in English). It needs no key or login, and it answers browsers on other sites, so it works from GitHub Pages without a proxy. IKEA doesn't document or promise any of this, and it can change or stop working at any time.
- **The planner doesn't depend on it.** If the search fails, the browser shows "IKEA online search is currently unavailable." and everything else keeps working. Searches run only when you click "Search IKEA online", never while typing.
- **Online results don't include reliable dimensions.** IKEA's search only returns a short size label, and its meaning depends on the product: "36x70 cm" is width × height for a drawer unit, and "140x200 cm" is the mattress size of a bed frame that is 156 × 209 cm. When you pick a result, you confirm width, depth and height before it is saved to My furniture. Only three-number labels such as "80x28x202 cm" are prefilled. Results that are already in the built-in catalog are added with their verified dimensions right away.
- No prices, stock levels or product photos are stored in projects. Photos from IKEA's servers only appear in online results and saved products, as optional thumbnails.

The details, including how IKEA's fields map to the internal model, are in [docs/furniture-catalog.md](docs/furniture-catalog.md).

### Adding furniture manually

For a one-off product, use **Custom object**, enter the dimensions from the manufacturer's page, and tick **Save to My furniture for reuse**.

To add a verified product to the built-in catalog for everyone, add an entry to `src/data/furniture/ikea.ts` (or a new file per manufacturer):

```ts
ikea({
  article: '004.735.46',
  name: 'ALEX',
  type: 'Drawer unit',
  variant: 'white',
  category: 'storage',
  kind: 'sideboard',
  width: 36,
  depth: 58,
  height: 70,
  url: 'https://www.ikea.com/de/de/p/alex-schubladenelement-weiss-00473546/',
  measured: 'Breite 36 cm, Tiefe 58 cm, Höhe 70 cm',
}),
```

Verify the dimensions on the product page first, record the source URL, keep the verification date current, bump `CATALOG_METADATA` in `src/catalog/catalog.ts`, and run `npm test`. The tests check every entry for consistency. The full checklist, including traps such as bed sizes, is in [docs/furniture-catalog.md](docs/furniture-catalog.md#adding-a-curated-product-manually).

### Data ownership

A placed item stores its own geometry and product details: width, depth, height, name, manufacturer, article number and product link. The catalog id is only kept for reference. Rooms therefore don't change or break when catalog entries are corrected, a product is discontinued, IKEA changes its website, or you are offline. Exported project files contain everything needed to rebuild the room on another computer without contacting IKEA.

## Local development

### Prerequisites

- **Node.js 22.12 or newer.** CI uses Node 24 (the version in `.nvmrc`, so `nvm use` or `fnm use` picks it up).
- **npm**, which comes with Node.js.

### Install and run

```bash
npm ci             # install the exact versions from package-lock.json
npm run dev        # dev server at http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm test` | Vitest unit tests (geometry, rules, store, import/export, catalog, IKEA provider with mocked requests) |
| `npm run typecheck` | TypeScript only (`tsc -b`) |
| `npm run lint` | ESLint |
| `npm run build` | Type-check and production build into `dist/` |
| `npm run preview` | Serve the production build from `dist/` at http://localhost:4173 |

The deploy workflow runs `typecheck`, `lint`, `test` and `build`. Running them locally before you push catches the same failures.

On first launch the app creates a sample 380 × 320 cm office with a window, a door, a 180 × 80 cm desk, an office chair, two 27″ monitors and a sideboard. **New plan** in the top bar starts over with one empty room; it can be undone.

### Testing the GitHub Pages build locally

GitHub Pages serves the app from a subdirectory such as `/room-planner/`, so every asset URL needs that prefix. To build and serve it the way Pages will:

```bash
# macOS / Linux
BASE_PATH=/room-planner/ npm run build
BASE_PATH=/room-planner/ npm run preview
```

```powershell
# Windows PowerShell
$env:BASE_PATH = "/room-planner/"; npm run build; npm run preview
```

Then open http://localhost:4173/room-planner/. In Git Bash on Windows, write `BASE_PATH=room-planner` without the leading slash: Git Bash turns values starting with `/` into Windows file paths, and the build stops with an error when that happens.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds the app and publishes `dist/` with GitHub's official Pages actions. It doesn't need a `gh-pages` branch, a deploy package or any secrets.

1. **Create a GitHub repository and push the code.** The repository name becomes the URL path.
   ```bash
   git remote add origin https://github.com/<username>/room-planner.git
   git push -u origin main
   ```
   With GitHub Free, Pages only works for public repositories.
2. Open the repository on GitHub and click **Settings**.
3. In the sidebar, under *Code and automation*, click **Pages**.
4. Under **Build and deployment → Source**, select **GitHub Actions**. Nothing else needs configuring.
5. **Push to `main`.** If you pushed before step 4, that first run failed. Start a new one from **Actions → Deploy to GitHub Pages → Run workflow**.
6. **Wait for the workflow to finish.** On the **Actions** tab, the *Deploy to GitHub Pages* run has two jobs: `build` (install, type-check, lint, test, build) and `deploy`. A run takes a minute or two.
7. **Open the site.** The URL is shown on the finished run under the `deploy` job, in **Settings → Pages** ("Your site is live at …"), and under **Deployments** on the repository's main page:

   ```
   https://<username>.github.io/<repository>/
   ```

   For example, `https://octocat.github.io/room-planner/`.

### What the workflow does

- Runs on every push to `main`, and on demand with **Run workflow**.
- The `build` job runs `npm ci`, `typecheck`, `lint`, `test` and `build`, then uploads `dist/`. If any step fails, nothing is deployed and the current site stays online.
- The `deploy` job publishes the uploaded build to the `github-pages` environment.
- `actions/configure-pages` reports the site's base path: `/<repository>` for project sites, and empty for `<username>.github.io` repositories and custom domains. The workflow passes it to Vite as `BASE_PATH`, so renaming the repository or adding a custom domain needs no code change.
- The `build` job, which installs third-party packages, can only read the repository and the Pages settings. Only the `deploy` job can publish.

### Troubleshooting

- **"Get Pages site failed"** in the *Read GitHub Pages settings* step: Pages is off, or its source isn't *GitHub Actions*. Do step 4, then re-run the workflow.
- **"Branch … is not allowed to deploy to github-pages"**: check that **Settings → Environments → github-pages → Deployment branches** includes `main`.
- **Blank page, 404s for `/assets/…`**: the build had the wrong base path. The workflow sets it automatically; this only happens with builds made outside it. See *Testing the GitHub Pages build locally*.

### Configuration

Build settings are read from environment variables in `vite.config.ts`, or from a gitignored `.env.local`, so no account or repository name is hard-coded:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASE_PATH` | `/` | URL path the app is served from. The workflow sets it. |
| `REPOSITORY_URL` | In GitHub Actions, the repository being built; otherwise none | "Source code" link in the About dialog (ⓘ in the top bar). Hidden when empty. |

The About dialog shows `version` from `package.json`. Builds made by GitHub Actions add the short commit hash, so you can see which commit is live. To change the version number, edit `version` in `package.json`.

**Everything deployed is public.** The values above end up in the JavaScript that anyone can download. Never put secrets, tokens or API keys into build environment variables or `.env` files. The app doesn't need any.

## Updating the application

Every push to `main` starts the workflow again and replaces the live site once all checks pass. A push made while a deployment is running waits for it to finish instead of cancelling it. GitHub Pages lets browsers cache files for up to 10 minutes, so a new version can take that long to appear; the build hash in the About dialog shows which commit you are running.

Deployments never touch saved projects. Those live in each visitor's browser, not on GitHub.

## Local data: projects live in your browser

Room Planner has no server and no accounts. The floor plan, layouts, furniture and settings are saved automatically to the browser's `localStorage` under the key `room-planner:project`, on the device you are using. Nothing is uploaded.

- **Projects don't sync.** They don't move between computers, browsers or browser profiles. A project made on your laptop won't appear on your desktop.
- **Each address has its own storage.** `http://localhost:5173` (dev server), `http://localhost:4173` (preview) and `https://<username>.github.io` are separate sites to the browser, and each has its own project.
- **Clearing browser storage deletes your projects.** That includes clearing site data or "cookies and other site data". Private and incognito windows discard the project when they close. Safari may also clear storage for sites you haven't opened for a while.
- **Export JSON is your backup.** **Export JSON** in the top bar downloads a file with the floor plan, every layout and the settings. **Import** loads that file in any browser and replaces the current project (`Ctrl+Z` undoes it). Use the pair to move a project to another computer, and export before clearing browser data.
- **My furniture, favorites and recently used** are stored separately under `room-planner:catalog`. They are not part of project files, so they don't move with an export. Furniture already placed in a room does move with it, because each item carries its own dimensions.
- **Older projects are upgraded automatically.** A project saved by an earlier version is migrated when it loads, and an untouched copy is kept under `room-planner:project:schema-<version>-backup` (for example `schema-2-backup` for projects saved before rooms, doors and windows existed, `schema-3-backup` for projects saved before rooms could have any shape, or `schema-4-backup` for projects saved before layouts could have their own floor plan). A project from before separate floor plans becomes one floor plan that all its layouts share, as before. A single-room project becomes a plan with that one room at the same place, so its furniture doesn't move, and rectangular rooms keep their doors and windows exactly where they were.

All project sites of one GitHub account share the origin `https://<username>.github.io`, and so share one `localStorage`. Two copies of Room Planner deployed under the same account would read and overwrite the same saved project.

## Architecture

```
src/
  types/        Domain model (Room, Wall, Opening, Layout, FurnitureItem, Settings, file format)
  geometry/     Pure TypeScript: rotated rectangles, SAT collisions, polygon clipping and
                containment, snapping, rotation snapping, wall/neighbor distances, bounds,
                viewport transforms, free area
  plan/         Pure TypeScript floor plan: mitered wall shapes, which room a point or item is
                in, "on the floor" checks across open-plan rooms, door/window cuts and swings,
                room docking and snapping, outline editing (shape.ts), wall drawing
                (drawing.ts) and Ruler snapping (ruler.ts)
  furniture/    Generic presets, item factory and placement, domain rules, layout analysis
  catalog/      Manufacturer-independent catalog: FurnitureProduct model, search and
                filters, product → room item conversion, My furniture (localStorage)
    providers/  Optional live sources behind one interface; ikea/ holds all IKEA-specific
                code (region config, request, response normalization)
  data/furniture/  Built-in catalog data: generic.ts (from presets), ikea.ts (curated)
  store/        Zustand store with undo/redo, pure document operations,
                persistence (localStorage) and import/export validation
  editor/       react-konva canvas: floors, walls, doors and windows, the selection box with its rotate
                handle, room and L-shape handles, the
                "Draw walls" tool, the Ruler, furniture nodes, labels, measurements, clearance/collision
                overlays, drag logic, transient UI state
  components/   Top bar, layout tabs, library, inspector, dialogs, UI primitives
    mobile/     Phone layout: bottom bar, sheets, selection card, draw and measure bars
  hooks/        Keyboard shortcuts, element size, commit-on-unmount for fields, folded groups,
                media queries (which layout, touch or mouse)
  utils/        Formatting, colors, ids, number parsing, file helpers
  appInfo.ts    Version, build hash and source URL, injected by vite.config.ts
docs/furniture-catalog.md      Catalog maintenance: adding products, IKEA mapping
.github/workflows/deploy.yml   Checks, build and GitHub Pages deployment
```

### Key decisions

- **Centimeters everywhere, degrees clockwise.** Items store the *center* of their footprint (`x`, `y`), which makes rotation trivial. The inspector's X/Y show the footprint's left and top edge instead, measured from the inner corner of the item's room, which equals the distance to its left and top wall and is what people actually think in.
- **A floor plan is a list of room outlines.** Each room is a simple polygon of interior corners, stored clockwise, with one wall per edge: a thickness, drawn outside the interior, or left open. Rectangles are just rooms with four corners. That covers apartments, balconies (one wall open), L-shaped rooms, niches and slanted walls, and open-plan spaces (rooms joined by open walls) without a wall graph. Neighbors share a wall because snapping keeps the gap between them at the thicker of the two walls. Every outline edit (moving a wall or corner, adding or removing a corner, setting a wall's length) is a pure function in `plan/shape.ts` that refuses outlines whose walls would cross, so a drag simply stops there.
- **Layouts point to a floor plan.** The project holds a list of floor plans, and each layout names one in `planId`. Several layouts on one plan see every room, wall and door change; moving or deleting a room carries or removes the furniture in all of them, and in no other layout. Unlinking adds a copy of the plan that keeps the room and opening ids, so a selected room stays selected when you switch between the two layouts. Because updates are immutable, the copy shares its rooms with the original until either one changes. A plan that no layout uses any more is dropped.
- **Moving a wall keeps the angles.** A dragged wall moves parallel to itself and its neighbors get longer or shorter along their own direction, so a rectangle stays a rectangle and a 45° corner stays 45°. Where the neighbor runs along the same line (a wall that was split), a short wall is inserted instead, which is what makes a niche or a bay. Typing a wall's length moves the next wall the same way.
- **Furniture belongs to a room by position.** Furniture is stored in plan coordinates, not per room. The room an item is in is the one containing its center, so moving an item into another room needs no bookkeeping. Moving a room carries the items inside it (in every layout on that floor plan); the set is decided when the drag starts, so a room dragged across other furniture doesn't pick it up.
- **Doors and windows belong to a wall.** An opening is stored as wall index + offset from the wall's start corner along the interior face, so it moves with its room and keeps its place when the room is reshaped: it keeps its distance from a corner that didn't move, or else its spot along the wall's line. Splitting or joining walls moves openings onto the right piece. Where two rooms share a wall (walls running along the same line), the gap is cut through both. A door's swing is a convex polygon, checked against furniture like a clearance zone.
- **"On the floor" is an area test.** Furniture is inside when the part of its footprint (its real rotated shape, not a bounding box) covered by room floors equals the whole footprint, which works for concave rooms and for furniture spanning two rooms of an open-plan space. Keeping furniture inside pushes it out of the walls it pokes through, trying the shortest push through one wall or two (at a corner) first.
- **Geometry is independent of React.** Collision detection, snapping, distances and coordinate conversion live in `src/geometry` as pure functions with unit tests. `furniture/rules.ts` adds domain meaning on top: monitors on a desk are not a collision, and a chair may stand in a desk's seating zone.
- **One analysis pass per change.** `analyzeLayout()` computes collisions, clearance conflicts, out-of-room items and free floor space once. It is memoized on the immutable furniture array and shared by the canvas, the inspector and the status chips.
- **Snapshot undo/redo.** The undoable document is `{ plans, layouts, activeLayoutId }`. Updates are immutable, so snapshots share structure and cost almost nothing. A drag, resize or rotate (of furniture, a room or a door) is one "gesture" and becomes one undo step; repeated nudges and color-picker changes merge into one step.
- **One selection.** Furniture, rooms and openings share `selectedId` (their ids never collide), and the inspector shows whichever is selected. New furniture without a drop position goes into the selected item's room, or else the room in the middle of the view.
- **Two stores.** The persisted and undoable project lives in `store/`. Transient editor state (zoom, pan, snap guides, hover) lives in `editor/uiStore.ts`, so it never reaches history or storage. The view follows the plan as it changes until you zoom, pan or drag a room; then it stays put until you click *Fit plan*.
- **Canvas coordinate systems.** Furniture is drawn in room coordinates inside a scaled Konva group, with non-scaling strokes. Labels and measurements are drawn in screen space so text stays crisp and a constant size at any zoom.
- **Defensive import.** `store/serialization.ts` validates every field, clamps values and fills defaults, so a hand-edited or older file still loads. The file carries a `format` and a `schemaVersion`; `migrateProject()` upgrades older files one version at a time. Links in files are only kept if they are `http(s)` URLs.
- **The planner doesn't know manufacturers.** It understands one normalized `FurnitureProduct` type. Curated data and live providers produce that type, and `productToItem()` copies everything into a self-contained `FurnitureItem`. IKEA field names, URLs and the region live only in `catalog/providers/ikea/` and `data/furniture/ikea.ts`.
- **Plain CSS with design tokens** instead of Tailwind: one stylesheet and no build plugin. That was simpler for a small, dense tool UI.

### File format

```jsonc
{
  "format": "room-planner-project",
  "schemaVersion": 5,                      // older files (v1–v4) are migrated on import
  "exportedAt": "2026-09-30T12:00:00.000Z",
  "plans": [                               // floor plans; several layouts can share one
    {
      "id": "…",
      "rooms": [
        {
          "id": "…", "name": "Office",
          "corners": [                         // interior corners in plan coordinates (cm), clockwise on screen
            { "x": 0, "y": 0 }, { "x": 380, "y": 0 }, { "x": 380, "y": 320 }, { "x": 0, "y": 320 }
          ],
          "walls": [                           // one per corner: wall i runs from corner i to corner i + 1
            { "kind": "wall", "thickness": 12 },  // top
            { "kind": "wall", "thickness": 12 },  // right
            { "kind": "open", "thickness": 12 },  // bottom, open (thickness kept for switching back)
            { "kind": "wall", "thickness": 12 }   // left
          ],
          "openings": [
            {
              "id": "…", "kind": "door",       // "door" | "window" | "passage"
              "wall": 0,                       // index into "walls"
              "offset": 70,                    // cm from the wall's start corner, along the wall
              "width": 80,
              "hinge": "start",                // doors: hinge at the "start" or "end" of the opening
              "swing": "in"                    // doors: "in" (into this room) or "out"
            }
          ]
        }
      ]
    }
  ],
  "layouts": [
    {
      "id": "…",
      "name": "Layout A",
      "planId": "…",                       // the floor plan this layout is arranged in
      "furniture": [
        {
          "id": "…", "type": "desk", "name": "Desk",
          "x": 130, "y": 40,                 // center, in plan coordinates (cm)
          "width": 180, "depth": 80, "height": 75,
          "rotation": 0,                      // degrees, clockwise
          "category": "desk", "color": "#dccaa9", "notes": "",
          "placement": "floor",               // "floor" | "surface": where it stands now
          "flexiblePlacement": false,         // true: on furniture when dropped onto it, else on the floor
          "ignoreCollisions": false,
          "clearance": { "enabled": false, "front": 90, "back": 0, "left": 0, "right": 0 },
          "shape": { "kind": "rect" },        // or { "kind": "l", "segment": 60, "returnWidth": 50, "returnSide": "right" }, or { "kind": "round" }
          "attachedTo": null,                 // id of the desk a monitor stands on
          "showDeskGuides": false
        },
        {
          "id": "…", "type": "sideboard", "name": "ALEX Drawer unit",
          "width": 36, "depth": 58, "height": 70, "…": "…",
          "product": {                        // only for manufacturer products; informational
            "catalogId": "ikea:00473546", "manufacturer": "IKEA",
            "productName": "ALEX", "productType": "Drawer unit", "variant": "white",
            "articleNumber": "004.735.46",
            "productUrl": "https://www.ikea.com/de/de/p/alex-schubladenelement-weiss-00473546/",
            "sourceLastVerified": "2026-09-30"
          }
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

- Walls are straight. A curved wall (a round bay window) can be approximated with a few short walls. Free-standing walls, columns, radiators, sockets and window sill heights aren't modeled.
- Furniture snaps only to horizontal and vertical walls, and the distance lines are measured horizontally and vertically. Next to a slanted wall, turn furniture with the rotate handle, which sticks to the wall's angle, then move it up to the wall by hand. "Inside the room" and collision checks use the true shapes.
- Walls belong to rooms, so a wall between two rooms is drawn by both. Give both sides the same thickness, or let snapping keep the gap at the thicker one, or the drawing gets uneven. A door cuts through a neighbor's wall only where the two walls run along the same line.
- Overlapping rooms aren't flagged. Snapping keeps neighbors apart, but a room placed on top of another with `Alt` or the X/Y fields is allowed.
- Doors swing 90° with a single leaf. Double, sliding and pocket doors can be approximated with a passage.
- Snapping and the "gap to neighbor" lines use axis-aligned bounding boxes. They are exact for 0/90/180/270° rotations and approximate for freely rotated items. Collisions and clearance checks always use the true rotated shape. Round items snap with their bounding box too, so two round tables snap where their circles touch only when they are side by side, not diagonally.
- Round outlines are checked as a 48-sided polygon inside the circle or oval, at most 0.25% of the radius short of it (under 2 mm for a Ø 120 table). Clearance zones of round items are rectangles along the sides of their bounding box.
- Attachment is one level deep (monitor → desk). Resizing a desk leaves attached items where they are, by design.
- Free floor area is rasterized on a 2 cm grid. That is accurate to well under 1% for typical rooms, but it is an estimate.
- Undo history is kept in memory only; it is not restored after a reload. The project itself is.
- `localStorage` is per browser and per origin. Use Export JSON for backups or to move between machines (see [Local data](#local-data-projects-live-in-your-browser)).
- There is one project per browser and site. To keep several apartments, export each one to its own file.
- The app is a single page without routes, so there are no deep links, and GitHub Pages needs no 404 fallback.
- The three-panel desktop layout needs roughly 1100 px of width; narrower than 900 px, the phone layout takes over. On a touch screen you add furniture by tapping it in the library (dragging it onto the plan needs a mouse), and there is no typing an exact wall length while drawing walls: set it afterwards in the room's *Walls* list.
- The curated IKEA catalog covers 69 products checked on IKEA Germany on 2026-09-30. IKEA can change dimensions or retire products; placed items are unaffected, but catalog entries need occasional re-checking.
- IKEA online search depends on an unofficial service and returns sizes only as short labels, so you confirm dimensions for products that aren't in the built-in catalog. Region is fixed to Germany (English names) in `catalog/providers/ikea/config.ts`.
- Search uses German-market English product names. German terms such as "Kommode" only find products in IKEA online search, not in the built-in catalog.
- My furniture, favorites and recently used items stay in the browser where they were created; they are not included in project exports.

## Adding what's out of scope later

The MVP deliberately leaves these out. This is where they would fit:

- **3D view (React Three Fiber)**: every item already has `height`, and `geometry/footprint.ts` gives the footprint polygons. A `src/viewer3d/` module could read the same store and extrude footprints, with a simple per-type mesh map, without touching the 2D editor.
- **Snapping furniture to slanted walls**: the rotate handle already sticks to wall angles (`geometry/rotation.ts`). `plan/walls.ts` has each wall's frame (direction and inward normal). A snap candidate that pushes a turned item's back flush against the nearest wall would go next to the straight-wall candidates in `geometry/snapping.ts`.
- **Free-standing walls and columns**: a list of short wall segments in the document, drawn with `wallPolygon`-style shapes and treated as obstacles in `furniture/analysis.ts` like another item's footprint.
- **Radiators, sockets, window sills**: point or short-segment features on a wall, stored like `openings` (wall + offset), with their own drawing in `editor/OpeningNode.tsx` and optional rules in `furniture/analysis.ts` (for example "tall furniture in front of a window").
- **Ergonomic scoring and viewing distance**: pure functions over `FurnitureItem[]` in `furniture/`, alongside `analysis.ts`. For example, eye-to-monitor distance could use the chair spot from `chairSpotForDesk`. Results can be rendered as another overlay, like `DeskGuides`.
- **Walking-path analysis**: rasterize the free floor (already done in `geometry/area.ts`), then run a distance transform or BFS to find narrow passages and the minimum corridor width between the door and key furniture.
- **Automatic layout generation**: a search over positions and rotations scored by collisions, clearances and ergonomics, all of which already exist as pure functions. It could run in a Web Worker and write results as new layout variants.
- **More manufacturers** (FlexiSpot, Desktronic, Ergotopia, JYSK, Steelcase, Herman Miller…): curated products go into a new `src/data/furniture/<maker>.ts`. A live source, if a manufacturer has a keyless browser-callable endpoint, implements `LiveCatalogProvider` in `src/catalog/providers/<maker>/`. See [docs/furniture-catalog.md](docs/furniture-catalog.md#adding-another-manufacturer).
- **Cable planning**: add point features (sockets, desk grommets) and polylines as a new item kind; the store's document model and history already handle arbitrary layout data.
- **Image/PDF export**: `stage.toDataURL()` on the Konva stage gives a PNG of the current view in a few lines.
- **Offline use / installable app (PWA)**: the build is already self-contained. Fonts are bundled, nothing is fetched at runtime, and the base path is set in one place. `vite-plugin-pwa` could precache `dist/` and add a web manifest without changes to application code.
