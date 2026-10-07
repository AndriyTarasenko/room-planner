/**
 * Curated LG TVs. The footprint is the TV on its included stand, since that is what takes
 * up space on a TV bench. Read docs/furniture-catalog.md before adding or changing entries.
 */
import type { FurnitureProduct } from '../../catalog/types';

export const LG_MANUFACTURER = 'LG';

export const LG_PRODUCTS: readonly FurnitureProduct[] = [
  {
    id: 'lg:oled65c6elb',
    manufacturer: LG_MANUFACTURER,
    productName: 'OLED65C6ELB',
    productFamily: 'OLED evo C6',
    productType: '65" OLED TV',
    variant: 'model year 2026',
    category: 'electronics',
    kind: 'tv',
    width: 144.1,
    depth: 23,
    height: 88,
    articleNumber: 'OLED65C6ELB',
    productUrl: 'https://www.lg.com/de/tvs-und-soundbars/oled-evo/oled65c6elb/',
    origin: 'built-in',
    // LG's page gives the size without the stand; the stand footprint comes from the Amazon listing.
    source: 'https://www.lg.com/de/tvs-und-soundbars/oled-evo/oled65c6elb/ (without stand); https://www.amazon.de/dp/B0GSGWPS8Z (with stand)',
    sourceLastVerified: '2026-10-07',
    metadata: {
      sourceMeasurements: 'LG: Breite 1441 mm, Höhe 826 mm, Tiefe 45.1 mm ohne Standfuß. Amazon, inkl. Standfuß: 144.1 cm B, 23 cm T, 88 cm H',
      listedSize: '65 Zoll (164 cm)',
    },
  },
];
