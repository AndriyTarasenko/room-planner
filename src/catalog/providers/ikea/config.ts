/**
 * Everything region- and identity-related for IKEA lives here, so supporting another country
 * later means changing (or making configurable) this one file.
 */

export const IKEA_MANUFACTURER = 'IKEA';

export interface IkeaRegion {
  /** Country code in IKEA's URLs, e.g. "de". */
  country: string;
  /** Language code in IKEA's URLs. IKEA Germany also serves English ("en"), which matches the app. */
  language: string;
}

/** Germany, with English product names. The only place the default region is defined. */
export const DEFAULT_IKEA_REGION: IkeaRegion = { country: 'de', language: 'en' };

/** Public storefront search service used by ikea.com itself (unofficial, may change). */
export const IKEA_SEARCH_HOST = 'https://sik.search.blue.cdtapps.com';

/** Only product pages and images on these hosts are linked or shown. */
export const IKEA_URL_HOSTS: readonly string[] = ['www.ikea.com'];

export function ikeaSearchUrl(query: string, region: IkeaRegion = DEFAULT_IKEA_REGION, size = 24): string {
  const params = new URLSearchParams({ q: query, size: String(size), types: 'PRODUCT' });
  return `${IKEA_SEARCH_HOST}/${encodeURIComponent(region.country)}/${encodeURIComponent(region.language)}/search-result-page?${params}`;
}

/** IKEA item numbers are 8 digits ("00473546"); SPR combinations use the same space. */
export const isIkeaItemNo = (value: unknown): value is string => typeof value === 'string' && /^\d{8}$/.test(value);

/** Catalog id shared by curated entries and live results, so the two can be matched up. */
export const ikeaProductId = (itemNo: string) => `ikea:${itemNo}`;

/** "00473546" → "004.735.46", as printed on IKEA price tags and product pages. */
export const formatIkeaArticleNumber = (itemNo: string) => `${itemNo.slice(0, 3)}.${itemNo.slice(3, 6)}.${itemNo.slice(6)}`;
