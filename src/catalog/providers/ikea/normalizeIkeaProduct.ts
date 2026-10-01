/**
 * Maps IKEA's storefront search data onto the internal catalog model. This is the only code
 * that knows IKEA's field names; if IKEA changes its response, this file (and types.ts)
 * are what need updating.
 *
 * Dimensions: search results only carry a short size label (`itemMeasureReferenceText`).
 * Its meaning depends on the product: "36x70 cm" is width × height for a drawer unit,
 * "140x60 cm" is width × depth for a desk, and "140x200 cm" is the *mattress* size for a bed
 * frame whose real footprint is 156 × 209 cm. Only the three-number form "80x28x202 cm" is
 * consistently width × depth × height (rounded), so only that form fills in dimensions.
 * Everything else leaves them empty for the user to enter from the product page. Tables listed
 * with a single number ("103 cm") are round, and the number is their diameter.
 */
import type { FurnitureType } from '../../../types';
import { isObject, optionalStr, safeHttpUrl } from '../../../utils/validate';
import { type CatalogCategory, LiveSearchError, type LiveProductCandidate, type ProductDimensions } from '../../types';
import { IKEA_MANUFACTURER, IKEA_URL_HOSTS, formatIkeaArticleNumber, ikeaProductId, isIkeaItemNo } from './config';
import type { IkeaRawProduct } from './types';

/** Keyword rules over IKEA's product class (or type name as a fallback), first match wins. */
const CLASS_RULES: readonly [RegExp, CatalogCategory, FurnitureType][] = [
  // Desk-and-chair sets, covers, spare parts, accessories and mattresses have no single usable footprint.
  [/table and chair|combination|cover|component|spare part|accessor|mattress|pillow|cushion|textile/, 'other', 'generic'],
  [/bedside|nightstand/, 'storage', 'sideboard'],
  [/washing machine|dryers?\b/, 'bathroom', 'washer'],
  [/dishwasher|fridge|freezer|\bovens?\b/, 'kitchen', 'appliance'],
  [/\bhobs?\b/, 'kitchen', 'stove'],
  // "sink and wash basins" and "base cabinets" also hold bathroom wash-basins (see WASH_BASIN).
  [/sink/, 'kitchen', 'sink'],
  [/base cabinet|wall cabinet/, 'kitchen', 'kitchen-cabinet'],
  [/desk/, 'desk', 'desk'],
  [/armchair|easy chair/, 'chair', 'armchair'],
  [/sofa|chaise|couch/, 'sofa', 'sofa'],
  // Footstools, pouffes and stools (bar and step stools too) have no backrest to draw.
  [/stool|pouffe/, 'chair', 'pouf'],
  [/chair/, 'chair', 'office-chair'],
  [/bed/, 'bed', 'bed'],
  [/wardrobe|high cabinet/, 'storage', 'wardrobe'],
  [/book|open storage|shel/, 'storage', 'shelf'],
  [/drawer|cabinet|media|sideboard|storage|dresser/, 'storage', 'sideboard'],
  [/table/, 'table', 'table'],
];

const SIT_STAND = /sit\s*\/\s*stand|sit-stand|sitz\s*\/\s*steh/i;
/** IKEA type names of bathroom basins: "Wash-basin with water trap", "Wash-stnd w drawers/wash-basin". */
const WASH_BASIN = /wash-(basin|stand|stnd)/i;
/** Chairs meant for a desk; IKEA's "chairs" class also holds dining chairs and stools. */
const DESK_CHAIR = /office|gaming|swivel|desk/i;
/** Bar stools in the "chairs" class; those with a backrest are drawn as chairs. */
const BACKLESS_STOOL = /^(?!.*backrest).*stool/i;

export function classifyIkeaProduct(filterClass: string | undefined, typeName: string | undefined): { category: CatalogCategory; kind: FurnitureType } {
  const text = (filterClass || typeName || '').toLowerCase();
  const rule = CLASS_RULES.find(([pattern]) => pattern.test(text));
  if (!rule) return { category: 'other', kind: 'generic' };
  const [, category, kind] = rule;
  if (category === 'desk' && typeName && SIT_STAND.test(typeName)) return { category, kind: 'sit-stand-desk' };
  if ((kind === 'sink' || kind === 'kitchen-cabinet') && typeName && WASH_BASIN.test(typeName)) return { category: 'bathroom', kind: 'washbasin' };
  if (kind === 'office-chair' && typeName && BACKLESS_STOOL.test(typeName)) return { category, kind: 'pouf' };
  if (kind === 'office-chair' && typeName && !DESK_CHAIR.test(typeName)) return { category, kind: 'chair' };
  return { category, kind };
}

const NUMBER = String.raw`(\d{1,4}(?:[.,]\d{1,2})?)`;
const THREE_DIMENSIONS = new RegExp(String.raw`^\s*${NUMBER}\s*x\s*${NUMBER}\s*x\s*${NUMBER}\s*cm\s*$`, 'i');

const ONE_DIMENSION = new RegExp(String.raw`^\s*${NUMBER}\s*cm\s*$`, 'i');

/**
 * Whether IKEA's listing marks the product as round: tables listed with one number ("103 cm")
 * have a round top of that diameter. Stools are listed with one number too, but theirs is the
 * seat height, so they aren't taken as round.
 */
export function isListedAsRound(kind: FurnitureType, listedSize: string | undefined): boolean {
  return kind === 'table' && listedSize !== undefined && ONE_DIMENSION.test(listedSize);
}

/** "80x28x202 cm" → 80 × 28 × 202. Anything else (two numbers, ranges like "120/170x80 cm") → null. */
export function parseListedSize(text: string | undefined): ProductDimensions | null {
  const m = text ? THREE_DIMENSIONS.exec(text) : null;
  if (!m) return null;
  const [width, depth, height] = m.slice(1, 4).map((v) => Number(v.replace(',', '.')));
  if (![width, depth, height].every((v) => v > 0)) return null;
  return { width, depth, height };
}

function ikeaUrl(value: unknown): string | undefined {
  const url = safeHttpUrl(value);
  if (!url) return undefined;
  const parsed = new URL(url);
  return parsed.protocol === 'https:' && IKEA_URL_HOSTS.includes(parsed.hostname) ? url : undefined;
}

function dimensionsNote(dimensions: ProductDimensions | null, listedSize: string | undefined, category: CatalogCategory, round: boolean): string {
  if (dimensions) return 'Width × depth × height from IKEA’s listing, rounded to whole cm. Check them on the product page.';
  if (!listedSize) return 'IKEA’s search results don’t include a size for this product. Enter the dimensions from the product page.';
  if (round) return `IKEA lists “${listedSize}”, the diameter of this round table. Enter it with the height from the product page.`;
  if (category === 'bed') {
    return `IKEA lists “${listedSize}”, which is the mattress size. The frame is larger: enter its dimensions from the product page.`;
  }
  return `IKEA lists “${listedSize}” without saying which sides are meant. Enter width, depth and height from the product page.`;
}

/** One search result → a live candidate, or null when it isn't a usable product. */
export function normalizeIkeaProduct(raw: unknown): LiveProductCandidate | null {
  if (!isObject(raw)) return null;
  const p = raw as IkeaRawProduct;
  const itemNo = isIkeaItemNo(p.itemNo) ? p.itemNo : isIkeaItemNo(p.itemNoGlobal) ? p.itemNoGlobal : null;
  const name = optionalStr(p.name, 120);
  if (!itemNo || !name) return null;

  const typeName = optionalStr(p.typeName, 120);
  const { category, kind } = classifyIkeaProduct(optionalStr(p.filterClass, 120), typeName);
  const listedSize = optionalStr(p.itemMeasureReferenceText, 60);
  const dimensions = parseListedSize(listedSize);
  const round = isListedAsRound(kind, listedSize);
  const productUrl = ikeaUrl(p.pipUrl);

  const metadata: Record<string, string> = {};
  if (listedSize) metadata.listedSize = listedSize;
  const price = p.salesPrice;
  if (price && typeof price.numeral === 'number' && Number.isFinite(price.numeral) && typeof price.currencyCode === 'string') {
    metadata.listedPrice = `${price.numeral.toFixed(2)} ${price.currencyCode.slice(0, 3)}`;
  }

  const candidate: LiveProductCandidate = {
    product: {
      id: ikeaProductId(itemNo),
      manufacturer: IKEA_MANUFACTURER,
      productName: name,
      productFamily: name,
      category,
      kind,
      articleNumber: formatIkeaArticleNumber(itemNo),
      origin: 'live',
      source: productUrl ?? 'IKEA online search',
    },
    dimensions,
    dimensionsNote: dimensionsNote(dimensions, listedSize, category, round),
  };
  const product = candidate.product;
  if (round) product.shape = { kind: 'round' };
  if (typeName) product.productType = typeName;
  const variant = optionalStr(p.validDesignText, 120);
  if (variant) product.variant = variant;
  if (productUrl) product.productUrl = productUrl;
  const imageUrl = ikeaUrl(p.mainImageUrl);
  if (imageUrl) product.imageUrl = imageUrl;
  if (Object.keys(metadata).length > 0) product.metadata = metadata;
  if (listedSize) candidate.listedSize = listedSize;
  return candidate;
}

/**
 * The whole search response → candidates (deduplicated, in IKEA's order). Throws a
 * LiveSearchError when the response no longer looks like what this code expects.
 */
export function normalizeIkeaSearchResponse(json: unknown): LiveProductCandidate[] {
  const page = isObject(json) ? json.searchResultPage : undefined;
  if (!isObject(page)) throw new LiveSearchError('bad-response', 'Unexpected IKEA search response.');
  const products = isObject(page.products) ? page.products : undefined;
  const main = products && isObject(products.main) ? products.main : undefined;
  // A valid page without a product list simply has no product matches.
  const items = main && Array.isArray(main.items) ? main.items : [];
  const seen = new Set<string>();
  const out: LiveProductCandidate[] = [];
  for (const item of items) {
    const candidate = isObject(item) ? normalizeIkeaProduct(item.product) : null;
    if (candidate && !seen.has(candidate.product.id)) {
      seen.add(candidate.product.id);
      out.push(candidate);
    }
  }
  return out;
}
