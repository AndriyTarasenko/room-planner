/**
 * The manufacturer-independent furniture catalog model. The planner only ever sees
 * `FurnitureProduct`; anything manufacturer-specific is turned into this shape by a
 * provider (see `providers/`) or written this way in the curated data (`src/data/furniture`).
 */
import type { Clearance, FurnitureType, Placement, Shape } from '../types';

/** Manufacturer name of the built-in generic furniture. */
export const GENERIC_MANUFACTURER = 'Generic';
/** Manufacturer name of custom objects the user saves to their catalog. */
export const CUSTOM_MANUFACTURER = 'Custom';

/** How the furniture browser groups and filters products. */
export type CatalogCategory =
  | 'desk'
  | 'chair'
  | 'storage'
  | 'bed'
  | 'sofa'
  | 'table'
  | 'kitchen'
  | 'bathroom'
  | 'electronics'
  | 'other';

/** Which catalog layer a product belongs to. */
export type CatalogOrigin =
  /** Shipped with the app: generic furniture and curated manufacturer products. */
  | 'built-in'
  /** Saved by the user in this browser (imported from a live provider, or custom). */
  | 'user'
  /** A transient result from a live provider; never placed or stored as is. */
  | 'live';

/**
 * Free-form extra data. Keys the app itself reads:
 * - `listedSize`: the manufacturer's own size label ("160x200 cm"); searchable, shown in details.
 *   Not a footprint: for beds it is the mattress size, for cabinets often width × height.
 * - `sourceMeasurements`: the measurement labels and values read from the source page.
 * - `dimensionsSource`: "listing" (taken from `listedSize`) or "user" (entered by the user).
 * - `importedOn`: YYYY-MM-DD a product was saved to My furniture.
 */
export type ProductMetadata = Record<string, string | number | boolean>;

export interface ProductDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface FurnitureProduct {
  /**
   * Globally unique and stable, prefixed with a manufacturer key: `generic:desk-180`,
   * `ikea:00473546`, `custom_…` for saved custom objects. Favorites and "recently used"
   * refer to products by id.
   */
  id: string;
  /** Display name, also used as the manufacturer filter: "Generic", "IKEA". */
  manufacturer: string;
  /** "ALEX", "Desk". */
  productName: string;
  /** Series or product line, e.g. "ALEX". */
  productFamily?: string;
  /** What the product is, in the manufacturer's words: "Drawer unit". */
  productType?: string;
  /** Finish or model variant: "white", "Vissle dark grey". */
  variant?: string;
  category: CatalogCategory;
  /** Planner behavior and top-down drawing (desk, bed, wardrobe…). */
  kind: FurnitureType;
  /** cm, along the front. */
  width: number;
  /** cm, from front to back. */
  depth: number;
  /** cm, overall height; the lowest setting for height-adjustable products. */
  height: number;
  /** Highest setting of height-adjustable products (sit/stand desks, office chairs). */
  heightMax?: number;
  /** Defaults to the kind's usual placement (monitors stand on furniture, everything else on the floor). */
  placement?: Placement;
  rotation?: number;
  clearance?: Partial<Clearance>;
  shape?: Shape;
  defaultColor?: string;
  /** As the manufacturer prints it, e.g. "004.735.46". */
  articleNumber?: string;
  productUrl?: string;
  /** Optional photo URL (live and saved products only). Never required. */
  imageUrl?: string;
  origin: CatalogOrigin;
  /** Where the dimensions come from: a product page URL or a short description. */
  source?: string;
  /** Date the dimensions were last checked against `source`, YYYY-MM-DD. */
  sourceLastVerified?: string;
  metadata?: ProductMetadata;
}

/**
 * A product found by a live provider. Its dimensions are only filled in when the provider
 * can read them unambiguously; the user confirms them before the product is saved or placed.
 */
export interface LiveProductCandidate {
  product: Omit<FurnitureProduct, keyof ProductDimensions | 'heightMax'>;
  dimensions: ProductDimensions | null;
  /** The size exactly as the source lists it, e.g. "36x70 cm". */
  listedSize?: string;
  /** Short explanation of how `dimensions` were derived, or why they are missing. */
  dimensionsNote: string;
}

export interface LiveSearchOptions {
  signal?: AbortSignal;
}

/**
 * An optional online product source. Providers must never throw raw errors at the UI:
 * failures surface as `LiveSearchError`, and the rest of the app works without them.
 */
export interface LiveCatalogProvider {
  /** Stable key, e.g. "ikea". */
  id: string;
  /** Matches `FurnitureProduct.manufacturer` of the products it returns. */
  manufacturer: string;
  /** Shown in the UI: "Search IKEA online". */
  label: string;
  search(query: string, options?: LiveSearchOptions): Promise<LiveProductCandidate[]>;
}

export type LiveSearchErrorReason = 'unavailable' | 'timeout' | 'bad-response' | 'aborted';

export class LiveSearchError extends Error {
  readonly reason: LiveSearchErrorReason;

  constructor(reason: LiveSearchErrorReason, message: string) {
    super(message);
    this.name = 'LiveSearchError';
    this.reason = reason;
  }
}
