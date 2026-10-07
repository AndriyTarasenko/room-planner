/**
 * Curated FlexiSpot products, checked by hand against flexispot.de. The product pages render
 * their specifications client-side, so `measured` records what the rendered page showed.
 * Read docs/furniture-catalog.md before adding or changing entries.
 */
import type { FurnitureProduct } from '../../catalog/types';

export const FLEXISPOT_MANUFACTURER = 'FlexiSpot';

export const FLEXISPOT_PRODUCTS: readonly FurnitureProduct[] = [
  {
    id: 'flexispot:q1lb',
    manufacturer: FLEXISPOT_MANUFACTURER,
    productName: 'Q1L',
    productFamily: 'Q1L',
    productType: 'L-shaped sit/stand corner desk',
    variant: 'black',
    category: 'desk',
    kind: 'l-desk',
    // Tops of 180 × 60 and 120 × 60 cm meeting in a corner: 180 × 120 overall, both arms 60 deep.
    // The frame mounts the return on either side; it starts on the right like the generic L desk.
    width: 180,
    depth: 120,
    height: 72,
    heightMax: 116.5,
    shape: { kind: 'l', segment: 60, returnWidth: 60, returnSide: 'right' },
    articleNumber: 'Q1LB-18012-EU',
    productUrl: 'https://www.flexispot.de/hoehenverstellbarer-eckschreibtisch-q1l.html?value=q1lb',
    origin: 'built-in',
    source: 'https://www.flexispot.de/hoehenverstellbarer-eckschreibtisch-q1l.html?value=q1lb',
    sourceLastVerified: '2026-10-07',
    metadata: {
      sourceMeasurements: 'Tischplattengröße 180 x 60 / 120 x 60 cm (Lange Seite 180 cm, Kurze Seite 120 cm), Höhenbereich 72 - 116.5 cm',
      listedSize: '180x120 cm',
    },
  },
];
