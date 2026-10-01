/**
 * The parts of IKEA's storefront search response this app reads. This is an unofficial,
 * undocumented interface: every field is optional and typed loosely, and
 * normalizeIkeaProduct.ts validates each value before using it.
 */

export interface IkeaSearchResponse {
  searchResultPage?: {
    products?: {
      main?: {
        items?: IkeaSearchItem[];
      };
    };
  };
}

export interface IkeaSearchItem {
  /** Absent for non-product results (content teasers, planners…). */
  product?: IkeaRawProduct;
}

export interface IkeaRawProduct {
  /** 8-digit item number, e.g. "00473546". */
  itemNo?: unknown;
  itemNoGlobal?: unknown;
  /** "ART" for single articles, "SPR" for combinations. */
  itemType?: unknown;
  /** Series name, e.g. "ALEX". */
  name?: unknown;
  /** Product type in the request language, e.g. "Drawer unit". */
  typeName?: unknown;
  /** Finish, e.g. "white". */
  validDesignText?: unknown;
  /**
   * A short size label, e.g. "36x70 cm", "80x28x202 cm", "140x200 cm". Its meaning depends
   * on the product type (width × height, width × depth, mattress size…), so only the
   * three-number form is used as width × depth × height.
   */
  itemMeasureReferenceText?: unknown;
  /** Language-independent product class, e.g. "desks", "chest of drawers", "bed frames". */
  filterClass?: unknown;
  /** Product page URL. */
  pipUrl?: unknown;
  mainImageUrl?: unknown;
  salesPrice?: {
    numeral?: unknown;
    currencyCode?: unknown;
  };
}
