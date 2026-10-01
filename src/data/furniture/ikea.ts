/**
 * Curated IKEA products. Every entry was checked by hand against its IKEA Germany product
 * page; `measured` records the labels and values used, e.g. that a bed frame's "Breite"
 * became its width and "Länge" its depth. Read docs/furniture-catalog.md before adding
 * or changing entries: products whose dimensions can't be verified don't belong here.
 */
import type { CatalogCategory, FurnitureProduct } from '../../catalog/types';
import { IKEA_MANUFACTURER, ikeaProductId } from '../../catalog/providers/ikea/config';
import type { FurnitureType } from '../../types';

/** Date the entries below were last checked against their product pages. */
export const IKEA_CATALOG_VERIFIED_ON = '2026-09-30';

interface CuratedEntry {
  /** Article number as IKEA prints it, e.g. "004.735.46". The catalog id is derived from it. */
  article: string;
  /** IKEA product name (the series), e.g. "ALEX". */
  name: string;
  /** IKEA's English product type, e.g. "Drawer unit". */
  type: string;
  /** Finish of the verified article. Other finishes may have other article numbers. */
  variant: string;
  category: CatalogCategory;
  kind: FurnitureType;
  /** cm along the front, front to back, and overall (lowest setting for adjustable products). */
  width: number;
  depth: number;
  height: number;
  heightMax?: number;
  /** IKEA Germany product page the dimensions were read from. */
  url: string;
  /** The page's measurement labels and values that were used, in width, depth, height order. */
  measured: string;
  /**
   * IKEA's short size label from its search results, e.g. "160x200 cm". Only for searching
   * and display: for beds it is the mattress size, for cabinets width × height.
   */
  listed?: string;
  /** Only when an entry was verified on a different date than IKEA_CATALOG_VERIFIED_ON. */
  verifiedOn?: string;
}

function ikea(entry: CuratedEntry): FurnitureProduct {
  const product: FurnitureProduct = {
    id: ikeaProductId(entry.article.replace(/\D/g, '')),
    manufacturer: IKEA_MANUFACTURER,
    productName: entry.name,
    productFamily: entry.name,
    productType: entry.type,
    variant: entry.variant,
    category: entry.category,
    kind: entry.kind,
    width: entry.width,
    depth: entry.depth,
    height: entry.height,
    articleNumber: entry.article,
    productUrl: entry.url,
    origin: 'built-in',
    source: entry.url,
    sourceLastVerified: entry.verifiedOn ?? IKEA_CATALOG_VERIFIED_ON,
    metadata: { sourceMeasurements: entry.measured },
  };
  if (entry.listed) product.metadata!.listedSize = entry.listed;
  if (entry.heightMax !== undefined) product.heightMax = entry.heightMax;
  return product;
}

export const IKEA_PRODUCTS: readonly FurnitureProduct[] = [
  ikea({ article: '804.834.38', name: 'ALEX', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 132, depth: 58, height: 76, url: 'https://www.ikea.com/de/de/p/alex-schreibtisch-weiss-80483438/', measured: 'Breite 132 cm, Tiefe 58 cm, Höhe 76 cm', listed: '132x58 cm' }),
  ikea({ article: '104.735.55', name: 'ALEX', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 100, depth: 48, height: 76, url: 'https://www.ikea.com/de/de/p/alex-schreibtisch-weiss-10473555/', measured: 'Breite 100 cm, Tiefe 48 cm, Höhe 76 cm', listed: '100x48 cm' }),
  ikea({ article: '602.141.59', name: 'MALM', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 140, depth: 65, height: 73, url: 'https://www.ikea.com/de/de/p/malm-schreibtisch-weiss-60214159/', measured: 'Breite 140 cm, Tiefe 65 cm, Höhe 73 cm', listed: '140x65 cm' }),
  ikea({ article: '302.130.76', name: 'MICKE', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 73, depth: 50, height: 75, url: 'https://www.ikea.com/de/de/p/micke-schreibtisch-weiss-30213076/', measured: 'Breite 73 cm, Tiefe 50 cm, Höhe 75 cm', listed: '73x50 cm' }),
  ikea({ article: '802.130.74', name: 'MICKE', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 105, depth: 50, height: 75, url: 'https://www.ikea.com/de/de/p/micke-schreibtisch-weiss-80213074/', measured: 'Breite 105 cm, Tiefe 50 cm, Höhe 75 cm', listed: '105x50 cm' }),
  ikea({ article: '902.143.08', name: 'MICKE', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 142, depth: 50, height: 75, url: 'https://www.ikea.com/de/de/p/micke-schreibtisch-weiss-90214308/', measured: 'Breite 142 cm, Tiefe 50 cm, Höhe 75 cm', listed: '142x50 cm' }),
  ikea({ article: '694.168.17', name: 'LAGKAPTEN / ALEX', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 120, depth: 60, height: 73, url: 'https://www.ikea.com/de/de/p/lagkapten-alex-schreibtisch-weiss-s69416817/', measured: 'Länge 120 cm, Breite 60 cm, Höhe 73 cm', listed: '120x60 cm' }),
  ikea({ article: '994.319.82', name: 'LAGKAPTEN / ALEX', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 140, depth: 60, height: 73, url: 'https://www.ikea.com/de/de/p/lagkapten-alex-schreibtisch-weiss-s99431982/', measured: 'Länge 140 cm, Breite 60 cm, Höhe 73 cm', listed: '140x60 cm' }),
  ikea({ article: '594.176.19', name: 'LAGKAPTEN / ALEX', type: 'Desk', variant: 'white', category: 'desk', kind: 'desk', width: 200, depth: 60, height: 73, url: 'https://www.ikea.com/de/de/p/lagkapten-alex-schreibtisch-weiss-s59417619/', measured: 'Länge 200 cm, Breite 60 cm, Höhe 73 cm', listed: '200x60 cm' }),
  ikea({ article: '299.321.81', name: 'LINNMON / ADILS', type: 'Table', variant: 'white', category: 'desk', kind: 'desk', width: 100, depth: 60, height: 74, url: 'https://www.ikea.com/de/de/p/linnmon-adils-tisch-weiss-s29932181/', measured: 'Länge 100 cm, Breite 60 cm, Höhe 74 cm', listed: '100x60 cm' }),
  ikea({ article: '805.076.27', name: 'UTESPELARE', type: 'Gaming desk', variant: 'black', category: 'desk', kind: 'desk', width: 160, depth: 80, height: 68, heightMax: 78, url: 'https://www.ikea.com/de/de/p/utespelare-gamingschreibtisch-schwarz-80507627/', measured: 'Breite 160 cm, Tiefe 80 cm, Höhe mind. 68 cm, Höhe max. 78 cm', listed: '160x80 cm' }),
  ikea({ article: '792.809.55', name: 'IDÅSEN', type: 'Desk sit/stand', variant: 'brown/dark grey', category: 'desk', kind: 'sit-stand-desk', width: 120, depth: 70, height: 63, heightMax: 127, url: 'https://www.ikea.com/de/de/p/idasen-schreibtisch-sitz-steh-braun-dunkelgrau-s79280955/', measured: 'Länge 120 cm, Breite 70 cm, Höhe mind. 63 cm, Höhe max. 127 cm', listed: '120x70 cm' }),
  ikea({ article: '392.810.04', name: 'IDÅSEN', type: 'Desk sit/stand', variant: 'brown/dark grey', category: 'desk', kind: 'sit-stand-desk', width: 160, depth: 80, height: 63, heightMax: 127, url: 'https://www.ikea.com/de/de/p/idasen-schreibtisch-sitz-steh-braun-dunkelgrau-s39281004/', measured: 'Länge 160 cm, Breite 80 cm, Höhe mind. 63 cm, Höhe max. 127 cm', listed: '160x80 cm' }),
  ikea({ article: '794.296.02', name: 'TROTTEN', type: 'Desk sit/stand', variant: 'white', category: 'desk', kind: 'sit-stand-desk', width: 160, depth: 80, height: 72, heightMax: 122, url: 'https://www.ikea.com/de/de/p/trotten-schreibtisch-sitz-steh-weiss-s79429602/', measured: 'Breite 160 cm, Tiefe 80 cm, Höhe mind. 72 cm, Höhe max. 122 cm', listed: '160x80 cm' }),
  ikea({ article: '496.218.71', name: 'TROTTEN', type: 'Desk sit/stand', variant: 'electric/white', category: 'desk', kind: 'sit-stand-desk', width: 120, depth: 70, height: 71, heightMax: 118, url: 'https://www.ikea.com/de/de/p/trotten-schreibtisch-sitz-steh-elektrisch-weiss-s49621871/', measured: 'Breite 120 cm, Tiefe 70 cm, Höhe mind. 71 cm, Höhe max. 118 cm', listed: '120x70 cm' }),
  ikea({ article: '396.218.95', name: 'TROTTEN', type: 'Desk sit/stand', variant: 'electric/white', category: 'desk', kind: 'sit-stand-desk', width: 160, depth: 80, height: 71, heightMax: 118, url: 'https://www.ikea.com/de/de/p/trotten-schreibtisch-sitz-steh-elektrisch-weiss-s39621895/', measured: 'Breite 160 cm, Tiefe 80 cm, Höhe mind. 71 cm, Höhe max. 118 cm', listed: '160x80 cm' }),
  ikea({ article: '995.275.69', name: 'MITTZON', type: 'Desk sit/stand', variant: 'electric white', category: 'desk', kind: 'sit-stand-desk', width: 120, depth: 80, height: 62, heightMax: 126, url: 'https://www.ikea.com/de/de/p/mittzon-schreibtisch-sitz-steh-elektrisch-weiss-s99527569/', measured: 'Breite 120 cm, Tiefe 80 cm, Höhe mind. 62 cm, Höhe max. 126 cm', listed: '120x80 cm' }),
  ikea({ article: '195.285.63', name: 'MITTZON', type: 'Desk sit/stand', variant: 'electric white', category: 'desk', kind: 'sit-stand-desk', width: 140, depth: 80, height: 62, heightMax: 126, url: 'https://www.ikea.com/de/de/p/mittzon-schreibtisch-sitz-steh-elektrisch-weiss-s19528563/', measured: 'Breite 140 cm, Tiefe 80 cm, Höhe mind. 62 cm, Höhe max. 126 cm', listed: '140x80 cm' }),
  ikea({ article: '595.299.66', name: 'MITTZON', type: 'Desk sit/stand', variant: 'electric white', category: 'desk', kind: 'sit-stand-desk', width: 160, depth: 80, height: 62, heightMax: 126, url: 'https://www.ikea.com/de/de/p/mittzon-schreibtisch-sitz-steh-elektrisch-weiss-s59529966/', measured: 'Breite 160 cm, Tiefe 80 cm, Höhe mind. 62 cm, Höhe max. 126 cm', listed: '160x80 cm' }),
  ikea({ article: '702.611.50', name: 'MARKUS', type: 'Office chair', variant: 'Vissle dark grey', category: 'chair', kind: 'office-chair', width: 62, depth: 60, height: 129, heightMax: 140, url: 'https://www.ikea.com/de/de/p/markus-drehstuhl-vissle-dunkelgrau-70261150/', measured: 'Breite 62 cm, Tiefe 60 cm, Höhe mind. 129 cm, Höhe max. 140 cm' }),
  ikea({ article: '894.244.68', name: 'FLINTAN', type: 'Office chair with armrests', variant: 'black', category: 'chair', kind: 'office-chair', width: 71, depth: 71, height: 103, heightMax: 114, url: 'https://www.ikea.com/de/de/p/flintan-drehstuhl-mit-armlehnen-schwarz-s89424468/', measured: 'Breite 71 cm, Tiefe 71 cm, Höhe mind. 103 cm, Höhe max. 114 cm' }),
  ikea({ article: '905.715.28', name: 'MATCHSPEL', type: 'Gaming chair', variant: 'Bomstad light grey', category: 'chair', kind: 'office-chair', width: 66, depth: 66, height: 120, heightMax: 132, url: 'https://www.ikea.com/de/de/p/matchspel-gamingstuhl-bomstad-hellgrau-90571528/', measured: 'Breite 66 cm, Tiefe 66 cm, Höhe mind. 120 cm, Höhe max. 132 cm' }),
  ikea({ article: '205.220.32', name: 'STYRSPEL', type: 'Gaming chair', variant: 'dark grey/grey', category: 'chair', kind: 'office-chair', width: 71, depth: 69, height: 119, heightMax: 142, url: 'https://www.ikea.com/de/de/p/styrspel-gamingstuhl-dunkelgrau-grau-20522032/', measured: 'Breite 71 cm, Tiefe 69 cm, Höhe mind. 119 cm, Höhe max. 142 cm' }),
  ikea({ article: '004.735.46', name: 'ALEX', type: 'Drawer unit', variant: 'white', category: 'storage', kind: 'sideboard', width: 36, depth: 58, height: 70, url: 'https://www.ikea.com/de/de/p/alex-schubladenelement-weiss-00473546/', measured: 'Breite 36 cm, Tiefe 58 cm, Höhe 70 cm', listed: '36x70 cm' }),
  ikea({ article: '904.861.39', name: 'ALEX', type: 'Drawer unit with 9 drawers', variant: 'white', category: 'storage', kind: 'sideboard', width: 36, depth: 48, height: 116, url: 'https://www.ikea.com/de/de/p/alex-schubladenelement-9-schubladen-weiss-90486139/', measured: 'Breite 36 cm, Tiefe 48 cm, Höhe 116 cm', listed: '36x116 cm' }),
  ikea({ article: '804.854.23', name: 'ALEX', type: 'Drawer unit on castors', variant: 'white', category: 'storage', kind: 'sideboard', width: 67, depth: 48, height: 66, url: 'https://www.ikea.com/de/de/p/alex-schubladenelement-auf-rollen-weiss-80485423/', measured: 'Breite 67 cm, Tiefe 48 cm, Höhe 66 cm', listed: '67x66 cm' }),
  ikea({ article: '404.747.61', name: 'TROTTEN', type: 'Cabinet with sliding doors', variant: 'white', category: 'storage', kind: 'sideboard', width: 80, depth: 55, height: 75, url: 'https://www.ikea.com/de/de/p/trotten-schiebetuerenschrank-weiss-40474761/', measured: 'Breite 80 cm, Tiefe 55 cm, Höhe 75 cm', listed: '80x55x75 cm' }),
  ikea({ article: '604.747.60', name: 'TROTTEN', type: 'Cabinet with sliding doors', variant: 'white', category: 'storage', kind: 'sideboard', width: 80, depth: 55, height: 110, url: 'https://www.ikea.com/de/de/p/trotten-schiebetuerenschrank-weiss-60474760/', measured: 'Breite 80 cm, Tiefe 55 cm, Höhe 110 cm', listed: '80x55x110 cm' }),
  ikea({ article: '802.145.49', name: 'MALM', type: 'Chest of 2 drawers', variant: 'white', category: 'storage', kind: 'sideboard', width: 40, depth: 48, height: 55, url: 'https://www.ikea.com/de/de/p/malm-kommode-mit-2-schubladen-weiss-80214549/', measured: 'Breite 40 cm, Tiefe 48 cm, Höhe 55 cm', listed: '40x55 cm' }),
  ikea({ article: '204.035.62', name: 'MALM', type: 'Chest of 3 drawers', variant: 'white', category: 'storage', kind: 'sideboard', width: 80, depth: 48, height: 78, url: 'https://www.ikea.com/de/de/p/malm-kommode-mit-3-schubladen-weiss-20403562/', measured: 'Breite 80 cm, Tiefe 48 cm, Höhe 78 cm', listed: '80x78 cm' }),
  ikea({ article: '304.035.71', name: 'MALM', type: 'Chest of 4 drawers', variant: 'white', category: 'storage', kind: 'sideboard', width: 80, depth: 48, height: 100, url: 'https://www.ikea.com/de/de/p/malm-kommode-mit-4-schubladen-weiss-30403571/', measured: 'Breite 80 cm, Tiefe 48 cm, Höhe 100 cm', listed: '80x100 cm' }),
  ikea({ article: '604.035.84', name: 'MALM', type: 'Chest of 6 drawers', variant: 'white', category: 'storage', kind: 'sideboard', width: 160, depth: 48, height: 78, url: 'https://www.ikea.com/de/de/p/malm-kommode-mit-6-schubladen-weiss-60403584/', measured: 'Breite 160 cm, Tiefe 48 cm, Höhe 78 cm', listed: '160x78 cm' }),
  ikea({ article: '102.392.80', name: 'HEMNES', type: 'Chest of 8 drawers', variant: 'white stain', category: 'storage', kind: 'sideboard', width: 160, depth: 50, height: 96, url: 'https://www.ikea.com/de/de/p/hemnes-kommode-mit-8-schubladen-weiss-gebeizt-10239280/', measured: 'Breite 160 cm, Tiefe 50 cm, Höhe 96 cm', listed: '160x96 cm' }),
  ikea({ article: '003.920.41', name: 'BRIMNES', type: 'Chest of 3 drawers', variant: 'white/frosted glass', category: 'storage', kind: 'sideboard', width: 78, depth: 46, height: 95, url: 'https://www.ikea.com/de/de/p/brimnes-kommode-mit-3-schubladen-weiss-frostglas-00392041/', measured: 'Breite 78 cm, Tiefe 46 cm, Höhe 95 cm', listed: '78x46x95 cm' }),
  ikea({ article: '502.638.38', name: 'BILLY', type: 'Bookcase', variant: 'white', category: 'storage', kind: 'shelf', width: 40, depth: 28, height: 202, url: 'https://www.ikea.com/de/de/p/billy-buecherregal-weiss-50263838/', measured: 'Breite 40 cm, Tiefe 28 cm, Höhe 202 cm', listed: '40x28x202 cm' }),
  ikea({ article: '002.638.50', name: 'BILLY', type: 'Bookcase', variant: 'white', category: 'storage', kind: 'shelf', width: 80, depth: 28, height: 202, url: 'https://www.ikea.com/de/de/p/billy-buecherregal-weiss-00263850/', measured: 'Breite 80 cm, Tiefe 28 cm, Höhe 202 cm', listed: '80x28x202 cm' }),
  ikea({ article: '302.638.44', name: 'BILLY', type: 'Bookcase', variant: 'white', category: 'storage', kind: 'shelf', width: 80, depth: 28, height: 106, url: 'https://www.ikea.com/de/de/p/billy-buecherregal-weiss-30263844/', measured: 'Breite 80 cm, Tiefe 28 cm, Höhe 106 cm', listed: '80x28x106 cm' }),
  ikea({ article: '903.015.55', name: 'KALLAX', type: 'Shelving unit', variant: 'white', category: 'storage', kind: 'shelf', width: 76.5, depth: 39, height: 41, url: 'https://www.ikea.com/de/de/p/kallax-regal-weiss-90301555/', measured: 'Breite 76.5 cm, Tiefe 39 cm, Höhe 41 cm', listed: '77x41 cm' }),
  ikea({ article: '202.758.14', name: 'KALLAX', type: 'Shelving unit', variant: 'white', category: 'storage', kind: 'shelf', width: 76.5, depth: 39, height: 76.5, url: 'https://www.ikea.com/de/de/p/kallax-regal-weiss-20275814/', measured: 'Breite 76.5 cm, Tiefe 39 cm, Höhe 76.5 cm', listed: '77x77 cm' }),
  ikea({ article: '905.224.20', name: 'KALLAX', type: 'Shelving unit', variant: 'white', category: 'storage', kind: 'shelf', width: 76.5, depth: 39, height: 111.5, url: 'https://www.ikea.com/de/de/p/kallax-regal-weiss-90522420/', measured: 'Breite 76.5 cm, Tiefe 39 cm, Höhe 111.5 cm', listed: '77x112 cm' }),
  ikea({ article: '802.758.87', name: 'KALLAX', type: 'Shelving unit', variant: 'white', category: 'storage', kind: 'shelf', width: 76.5, depth: 39, height: 146.5, url: 'https://www.ikea.com/de/de/p/kallax-regal-weiss-80275887/', measured: 'Breite 76.5 cm, Tiefe 39 cm, Höhe 146.5 cm', listed: '77x147 cm' }),
  ikea({ article: '302.758.61', name: 'KALLAX', type: 'Shelving unit', variant: 'white', category: 'storage', kind: 'shelf', width: 147, depth: 39, height: 146.5, url: 'https://www.ikea.com/de/de/p/kallax-regal-weiss-30275861/', measured: 'Breite 147 cm, Tiefe 39 cm, Höhe 146.5 cm', listed: '147x147 cm' }),
  ikea({ article: '904.582.21', name: 'PAX', type: 'Wardrobe frame', variant: 'white', category: 'storage', kind: 'wardrobe', width: 49.8, depth: 58, height: 236.4, url: 'https://www.ikea.com/de/de/p/pax-korpus-kleiderschrank-weiss-90458221/', measured: 'Breite 49.8 cm, Tiefe 58.0 cm, Höhe 236.4 cm', listed: '50x58x236 cm' }),
  ikea({ article: '804.582.07', name: 'PAX', type: 'Wardrobe frame', variant: 'white', category: 'storage', kind: 'wardrobe', width: 99.8, depth: 58, height: 236.4, url: 'https://www.ikea.com/de/de/p/pax-korpus-kleiderschrank-weiss-80458207/', measured: 'Breite 99.8 cm, Tiefe 58.0 cm, Höhe 236.4 cm', listed: '100x58x236 cm' }),
  ikea({ article: '294.947.51', name: 'PAX', type: '2 wardrobe frames', variant: 'white', category: 'storage', kind: 'wardrobe', width: 149.6, depth: 58, height: 236.4, url: 'https://www.ikea.com/de/de/p/pax-2x-korpus-kleiderschrank-weiss-s29494751/', measured: 'Breite 149.6 cm, Tiefe 58.0 cm, Höhe 236.4 cm', listed: '150x58x236 cm' }),
  ikea({ article: '095.030.11', name: 'PAX / BERGSBO', type: 'Wardrobe', variant: 'white/white', category: 'storage', kind: 'wardrobe', width: 100, depth: 60, height: 201.2, url: 'https://www.ikea.com/de/de/p/pax-bergsbo-kleiderschrank-weiss-weiss-s09503011/', measured: 'Breite 100.0 cm, Tiefe 60.0 cm, Höhe 201.2 cm', listed: '100x60x201 cm' }),
  ikea({ article: '495.026.65', name: 'PAX / FORSAND', type: 'Wardrobe', variant: 'white/white', category: 'storage', kind: 'wardrobe', width: 100, depth: 60, height: 236.4, url: 'https://www.ikea.com/de/de/p/pax-forsand-kleiderschrank-weiss-weiss-s49502665/', measured: 'Breite 100.0 cm, Tiefe 60.0 cm, Höhe 236.4 cm', listed: '100x60x236 cm' }),
  ikea({ article: '804.372.34', name: 'KLEPPSTAD', type: 'Wardrobe with 2 doors', variant: 'white', category: 'storage', kind: 'wardrobe', width: 79, depth: 55, height: 176, url: 'https://www.ikea.com/de/de/p/kleppstad-schrank-mit-2-tueren-weiss-80437234/', measured: 'Breite 79 cm, Tiefe 55 cm, Höhe 176 cm', listed: '79x55x176 cm' }),
  ikea({ article: '004.417.58', name: 'KLEPPSTAD', type: 'Wardrobe with 3 doors', variant: 'white', category: 'storage', kind: 'wardrobe', width: 117, depth: 55, height: 176, url: 'https://www.ikea.com/de/de/p/kleppstad-kleiderschrank-mit-3-tueren-weiss-00441758/', measured: 'Breite 117 cm, Tiefe 55 cm, Höhe 176 cm', listed: '117x55x176 cm' }),
  ikea({ article: '404.004.78', name: 'BRIMNES', type: 'Wardrobe with 2 doors', variant: 'white', category: 'storage', kind: 'wardrobe', width: 78, depth: 50, height: 190, url: 'https://www.ikea.com/de/de/p/brimnes-kleiderschrank-2-tuerig-weiss-40400478/', measured: 'Breite 78 cm, Tiefe 50 cm, Höhe 190 cm', listed: '78x50x190 cm' }),
  ikea({ article: '404.079.22', name: 'BRIMNES', type: 'Wardrobe with 3 doors', variant: 'white', category: 'storage', kind: 'wardrobe', width: 117, depth: 50, height: 190, url: 'https://www.ikea.com/de/de/p/brimnes-kleiderschrank-3-tuerig-weiss-40407922/', measured: 'Breite 117 cm, Tiefe 50 cm, Höhe 190 cm', listed: '117x50x190 cm' }),
  ikea({ article: '903.473.51', name: 'SONGESAND', type: 'Wardrobe', variant: 'white', category: 'storage', kind: 'wardrobe', width: 120, depth: 60, height: 191, url: 'https://www.ikea.com/de/de/p/songesand-kleiderschrank-weiss-90347351/', measured: 'Breite 120 cm, Tiefe 60 cm, Höhe 191 cm', listed: '120x60x191 cm' }),
  ikea({ article: '002.494.87', name: 'MALM', type: 'Bed frame, high', variant: 'white', category: 'bed', kind: 'bed', width: 105, depth: 209, height: 100, url: 'https://www.ikea.com/de/de/p/malm-bettgestell-hoch-weiss-00249487/', measured: 'Breite 105 cm, Länge 209 cm, Höhe 100 cm', listed: '90x200 cm' }),
  ikea({ article: '299.315.96', name: 'MALM', type: 'Bed frame, high', variant: 'white', category: 'bed', kind: 'bed', width: 156, depth: 209, height: 100, url: 'https://www.ikea.com/de/de/p/malm-bettgestell-hoch-weiss-s29931596/', measured: 'Breite 156 cm, Länge 209 cm, Höhe 100 cm', listed: '140x200 cm' }),
  ikea({ article: '099.293.73', name: 'MALM', type: 'Bed frame, high', variant: 'white', category: 'bed', kind: 'bed', width: 176, depth: 209, height: 100, url: 'https://www.ikea.com/de/de/p/malm-bettgestell-hoch-weiss-s09929373/', measured: 'Breite 176 cm, Länge 209 cm, Höhe 100 cm', listed: '160x200 cm' }),
  ikea({ article: '299.316.00', name: 'MALM', type: 'Bed frame, high', variant: 'white', category: 'bed', kind: 'bed', width: 196, depth: 209, height: 100, url: 'https://www.ikea.com/de/de/p/malm-bettgestell-hoch-weiss-s29931600/', measured: 'Breite 196 cm, Länge 209 cm, Höhe 100 cm', listed: '180x200 cm' }),
  ikea({ article: '005.712.45', name: 'SLATTUM', type: 'Upholstered bed frame', variant: 'Vissle dark grey', category: 'bed', kind: 'bed', width: 144, depth: 206, height: 85, url: 'https://www.ikea.com/de/de/p/slattum-bettgestell-gepolstert-vissle-dunkelgrau-00571245/', measured: 'Breite 144 cm, Länge 206 cm, Kopfteilhöhe 85 cm', listed: '140x200 cm' }),
  ikea({ article: '903.493.26', name: 'HEMNES', type: 'Day-bed frame with 3 drawers', variant: 'white', category: 'bed', kind: 'sofa', width: 209, depth: 89, height: 83, url: 'https://www.ikea.com/de/de/p/hemnes-tagesbettgestell-3-schubladen-weiss-90349326/', measured: 'Länge 209 cm, Breite 89 cm, Höhe 83 cm', listed: '80x200 cm' }),
  ikea({ article: '504.890.12', name: 'GLOSTAD', type: '2-seat sofa', variant: 'Knisa dark grey', category: 'sofa', kind: 'sofa', width: 121, depth: 78, height: 68, url: 'https://www.ikea.com/de/de/p/glostad-2er-sofa-knisa-dunkelgrau-50489012/', measured: 'Breite 121 cm, Tiefe 78 cm, Höhe Rückenstütze 68 cm' }),
  ikea({ article: '405.732.85', name: 'GLOSTAD', type: '3-seat sofa', variant: 'Knisa dark grey', category: 'sofa', kind: 'sofa', width: 171, depth: 78, height: 68, url: 'https://www.ikea.com/de/de/p/glostad-3er-sofa-knisa-dunkelgrau-40573285/', measured: 'Breite 171 cm, Tiefe 78 cm, Höhe Rückenstütze 68 cm' }),
  ikea({ article: '403.993.14', name: 'KLIPPAN', type: '2-seat sofa', variant: 'Bomstad black', category: 'sofa', kind: 'sofa', width: 177, depth: 88, height: 66, url: 'https://www.ikea.com/de/de/p/klippan-2er-sofa-bomstad-schwarz-40399314/', measured: 'Breite 177 cm, Tiefe 88 cm, Höhe 66 cm' }),
  ikea({ article: '094.405.99', name: 'KIVIK', type: '2-seat sofa', variant: 'Tibbleby beige/grey', category: 'sofa', kind: 'sofa', width: 190, depth: 95, height: 83, url: 'https://www.ikea.com/de/de/p/kivik-2er-sofa-tibbleby-beige-grau-s09440599/', measured: 'Breite 190 cm, Tiefe 95 cm, Höhe 83 cm' }),
  ikea({ article: '394.430.49', name: 'KIVIK', type: '3-seat sofa', variant: 'Kelinge grey-turquoise', category: 'sofa', kind: 'sofa', width: 228, depth: 95, height: 83, url: 'https://www.ikea.com/de/de/p/kivik-3er-sofa-kelinge-grautuerkis-s39443049/', measured: 'Breite 228 cm, Tiefe 95 cm, Höhe 83 cm' }),
  ikea({ article: '595.090.01', name: 'EKTORP', type: '3-seat sofa', variant: 'Hakebo grey-green', category: 'sofa', kind: 'sofa', width: 218, depth: 88, height: 88, url: 'https://www.ikea.com/de/de/p/ektorp-3er-sofa-hakebo-graugruen-s59509001/', measured: 'Breite 218 cm, Tiefe 88 cm, Höhe inkl. Rückenpolster 88 cm' }),
  ikea({ article: '004.500.88', name: 'LACK', type: 'TV bench', variant: 'white', category: 'storage', kind: 'sideboard', width: 90, depth: 26, height: 45, url: 'https://www.ikea.com/de/de/p/lack-tv-bank-weiss-00450088/', measured: 'Breite 90 cm, Tiefe 26 cm, Höhe 45 cm', listed: '90x26x45 cm' }),
  ikea({ article: '304.989.27', name: 'LACK', type: 'TV bench', variant: 'white', category: 'storage', kind: 'sideboard', width: 160, depth: 35, height: 36, url: 'https://www.ikea.com/de/de/p/lack-tv-bank-weiss-30498927/', measured: 'Breite 160 cm, Tiefe 35 cm, Höhe 36 cm', listed: '160x35x36 cm' }),
  ikea({ article: '004.740.70', name: 'BESTÅ', type: 'TV bench', variant: 'white', category: 'storage', kind: 'sideboard', width: 180, depth: 40, height: 38, url: 'https://www.ikea.com/de/de/p/besta-tv-bank-weiss-00474070/', measured: 'Breite 180 cm, Tiefe 40 cm, Höhe 38 cm', listed: '180x40x38 cm' }),
  ikea({ article: '304.499.08', name: 'LACK', type: 'Side table', variant: 'white', category: 'table', kind: 'table', width: 55, depth: 55, height: 45, url: 'https://www.ikea.com/de/de/p/lack-beistelltisch-weiss-30449908/', measured: 'Länge 55 cm, Breite 55 cm, Höhe 45 cm', listed: '55x55 cm' }),
  ikea({ article: '904.499.05', name: 'LACK', type: 'Coffee table', variant: 'white', category: 'table', kind: 'table', width: 90, depth: 55, height: 45, url: 'https://www.ikea.com/de/de/p/lack-couchtisch-weiss-90449905/', measured: 'Länge 90 cm, Breite 55 cm, Höhe 45 cm', listed: '90x55 cm' }),
];
