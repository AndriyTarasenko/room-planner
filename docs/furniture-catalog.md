# Furniture catalog: maintainer guide

How the catalog is built, how to add a real product safely, and how IKEA data is mapped. For the user-facing overview, see the README.

## Layers

| Layer | Where | Origin | Notes |
| --- | --- | --- | --- |
| Generic furniture | `src/data/furniture/generic.ts` (built from `src/furniture/presets.ts`) | `built-in` | Typical sizes, always offline. |
| Curated manufacturer products | `src/data/furniture/ikea.ts` | `built-in` | Real products, dimensions verified by hand. |
| My furniture | `localStorage` key `room-planner:catalog` | `user` | Saved from online search or custom objects. Also holds favorites and the 8 most recently used ids. |
| Live results | `src/catalog/providers/*` | `live` | Optional, online, never placed without the user confirming the size. |

```
IKEA storefront search ──► IkeaProvider.search()         (providers/ikea/IkeaProvider.ts)
                             │ normalizeIkeaSearchResponse (providers/ikea/normalizeIkeaProduct.ts)
                             ▼
                      LiveProductCandidate ──► user confirms size ──► FurnitureProduct (origin "user")
                                                                             │
curated data (data/furniture/*.ts) ───────────────► FurnitureProduct ────────┤
                                                                             ▼
                                                  productToItem()  (catalog/productToItem.ts)
                                                                             ▼
                                               FurnitureItem in the project (own copy of everything)
```

The planner (`store/`, `editor/`, `geometry/`) only knows `FurnitureProduct` and `FurnitureItem`. Nothing outside `src/catalog/providers/ikea/` and `src/data/furniture/ikea.ts` knows IKEA's field names, URLs or region.

## The model

`FurnitureProduct` (`src/catalog/types.ts`), dimensions in cm:

| Field | Meaning |
| --- | --- |
| `id` | Stable and globally unique, prefixed by manufacturer: `generic:desk-180`, `ikea:00473546`. Favorites and recents store ids. |
| `manufacturer` | Display name, also the filter value: `Generic`, `IKEA`, `Custom`. |
| `productName`, `productFamily`, `productType`, `variant` | "ALEX", "ALEX", "Drawer unit", "white". The placed item is named `productName productType`. |
| `category` | Browser grouping: desk, chair, storage, bed, sofa, table, kitchen, bathroom, electronics, other. |
| `kind` | Planner behavior and top-down drawing (`desk`, `sit-stand-desk`, `bed`, `wardrobe`, `kitchen-cabinet`, `sink`, `toilet`, `tv`, …). Desks host monitors, TV benches host TVs and kitchen cabinets host microwaves and wall cabinets; office chairs are placed in front of desks. |
| `width`, `depth`, `height` | Width along the front, depth front to back, overall height (lowest setting for adjustable products). |
| `heightMax` | Highest setting of height-adjustable products. |
| `shape` | Optional outline: `{ "kind": "l", … }` for L-shaped sofas, desks and counters, `{ "kind": "round" }` for round and oval tables, poufs and plants (a circle when width equals depth). Rectangular when absent. |
| `defaultColor` | Optional fill color of placed items, instead of the category color (generic plants are green). |
| `articleNumber`, `productUrl`, `imageUrl` | As published by the manufacturer. URLs must be `https`. |
| `source`, `sourceLastVerified` | Where the dimensions come from, and the date they were checked. |
| `metadata` | Extras. Keys the app reads: `listedSize`, `sourceMeasurements`, `dimensionsSource`, `importedOn`. Prices, if any, are kept here only. |

Planner defaults that a product doesn't specify (a chair's 180° rotation, a wardrobe's door clearance) come from the generic preset of the same `kind`.

## Adding a curated product manually

Accuracy matters more than catalog size. If a dimension can't be verified on the manufacturer's product page, don't add the product.

1. **Verify the dimensions.** Open the product page on IKEA Germany (`https://www.ikea.com/de/de/p/…`) and read the measurements section ("Maße"). Use the product's own dimensions, not the package, and not the label in the title:
   - IKEA titles use short labels whose meaning varies: "36x70 cm" is width × height for a drawer unit; "140x200 cm" is the *mattress* size of a bed frame that is really 156 × 209 cm.
   - Tables often list `Länge` (long side) and `Breite` (short side). Beds list `Breite` (across) and `Länge` (head to foot). Map them so `width` runs along the side that faces the room or wall: for beds, width = Breite, depth = Länge.
   - Adjustable products list `Höhe mind.` / `Höhe max.` → `height` / `heightMax`.
   - Each size is its own entry with its own article number. Never reuse one entry for "KALLAX" in general.
2. **Add the entry** to `IKEA_PRODUCTS` in `src/data/furniture/ikea.ts`:
   ```ts
   ikea({
     article: '004.735.46', // as printed on the page; the id "ikea:00473546" is derived from it
     name: 'ALEX',
     type: 'Drawer unit', // IKEA's English type name (the /de/en/ page)
     variant: 'white',
     category: 'storage',
     kind: 'sideboard',
     width: 36,
     depth: 58,
     height: 70,
     url: 'https://www.ikea.com/de/de/p/alex-schubladenelement-weiss-00473546/',
     measured: 'Breite 36 cm, Tiefe 58 cm, Höhe 70 cm', // exactly what you read, in W, D, H order
     listed: '36x70 cm', // optional: IKEA's size label, so people can search for it
   }),
   ```
3. **Provide the source URL** (`url`). It becomes both the product link and the provenance.
4. **Provide the verification date.** Entries use `IKEA_CATALOG_VERIFIED_ON`. If you verify only a few entries on another day, set `verifiedOn: 'YYYY-MM-DD'` on those.
5. **Bump the catalog version** in `src/catalog/catalog.ts` (`CATALOG_METADATA.version` and `lastUpdated`). The About dialog shows it.
6. **Run the tests:** `npm test`. `src/data/furniture/catalogData.test.ts` checks every entry: unique ids, article number ↔ id ↔ URL consistency, an IKEA Germany URL, a date, plausible sizes, that every dimension appears in `measured`, and one entry per geometry.

Changing an existing entry never changes rooms that already contain it: placed items keep their own copy.

## How the IKEA provider maps data

Endpoint (unofficial, used by ikea.com itself, no key or login):

```
GET https://sik.search.blue.cdtapps.com/{country}/{language}/search-result-page?q=<query>&size=24&types=PRODUCT
```

Region is set once in `src/catalog/providers/ikea/config.ts` (`DEFAULT_IKEA_REGION`: country `de`, language `en`, so type names match the English UI). The response is read from `searchResultPage.products.main.items[].product`:

| IKEA field | FurnitureProduct | Notes |
| --- | --- | --- |
| `itemNo` (8 digits; `itemNoGlobal` as fallback) | `id` = `ikea:<itemNo>`, `articleNumber` = `004.735.46` | Same id as curated entries, so the UI can use verified data instead. |
| `name` | `productName`, `productFamily` | |
| `typeName` | `productType` | Also detects sit/stand desks. |
| `validDesignText` | `variant` | |
| `filterClass` (fallback: `typeName`) | `category`, `kind` | Keyword rules in `CLASS_RULES`: desks, chairs, armchairs, sofas, beds, wardrobes, shelving, cabinets, tables, kitchen cabinets, sinks, hobs, appliances and washing machines. The type name refines a few: sit/stand desks, dining chairs vs. office chairs, backless bar stools, and bathroom wash-basins and wash-stands (IKEA files them under the same classes as kitchen sinks and base cabinets). Footstools, pouffes and stools become `pouf`. Sets, covers, cushions, spare parts, accessories and mattresses become `other`. |
| `itemMeasureReferenceText` | `metadata.listedSize`; dimensions only for `AxBxC cm` | The three-number form is width × depth × height (rounded). Two numbers, ranges ("120/170x80") and single numbers give **no** dimensions: the user enters them from the product page. A table listed with a single number ("103 cm") is round with that diameter, so it gets `shape: round`; stools are listed the same way, but their number is the seat height. |
| `pipUrl`, `mainImageUrl` | `productUrl`, `imageUrl` | Kept only if `https://www.ikea.com/…`. |
| `salesPrice.numeral` + `currencyCode` | `metadata.listedPrice` | Informational only. Availability is not stored. |

When a user saves a result, the dimensions they confirmed are stored with `metadata.dimensionsSource` (`listing` if unchanged from the three-number label, otherwise `user`) and `metadata.importedOn`.

### Failure handling

`IkeaProvider.search()` turns every problem into a `LiveSearchError` (`unavailable`, `timeout`, `bad-response`, `aborted`): network errors, CORS rejections, HTTP errors, non-JSON answers and a changed schema. The UI shows "IKEA online search is currently unavailable." and logs details to the console. Searches run only on an explicit click, are cached in memory for 10 minutes, time out after 10 seconds and cancel the previous request.

The request is a plain `GET` without custom headers or cookies, so it is a CORS "simple request". It works from a static site as long as IKEA answers with `Access-Control-Allow-Origin` (on 2026-09-30 it answered `*`). If IKEA stops doing that, the provider fails gracefully; the fix is to remove the provider from `LIVE_PROVIDERS`, not to add a proxy or credentials. Product pages and IKEA's other APIs (`api.ingka.ikea.com`, `api.salesitem.ingka.com`) are not used: they either don't allow cross-origin reads or require a client id.

Tests use a trimmed real response (`searchResponse.fixture.ts`) and a mocked `fetch`; they never call IKEA.

## Adding another manufacturer

- **Curated products** (e.g. FlexiSpot desks): create `src/data/furniture/flexispot.ts` exporting `FurnitureProduct[]` with ids like `flexispot:<model>` and `manufacturer: 'FlexiSpot'`, then append it to `BUILT_IN_PRODUCTS` in `src/catalog/catalog.ts`. The manufacturer filter picks it up automatically. Copy the checks in `catalogData.test.ts` for the new source.
- **A live provider** (only if the manufacturer has a browser-callable, keyless endpoint): add `src/catalog/providers/<name>/` implementing `LiveCatalogProvider` (`search(query, { signal })` → `LiveProductCandidate[]`), keep all field mapping in its own `normalize…` module with fixture-based tests, and list it in `src/catalog/providers/index.ts`. The furniture browser renders a "Search … online" section per provider without other changes.

Never add API keys, tokens or a proxy: everything deployed to GitHub Pages is public.
