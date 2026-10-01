/**
 * Trimmed copy of a real IKEA Germany (English) search response from 2026-09-30, plus a few
 * hostile or broken entries. Tests use it instead of calling IKEA.
 */
export const IKEA_SEARCH_FIXTURE = {
  usergroup: '[]',
  searchResultPage: {
    searchPhrase: 'alex',
    products: {
      main: {
        items: [
          {
            metadata: 'v1;1;PRODUCT;00473546;products_main;',
            product: {
              name: 'ALEX',
              typeName: 'Drawer unit',
              itemMeasureReferenceText: '36x70 cm',
              mainImageUrl: 'https://www.ikea.com/de/en/images/products/alex-drawer-unit-white__0977775_pe813763_s5.jpg',
              pipUrl: 'https://www.ikea.com/de/en/p/alex-drawer-unit-white-00473546/',
              filterClass: 'chest of drawers',
              id: '00473546',
              itemNoGlobal: '00473546',
              itemNo: '00473546',
              itemType: 'ART',
              validDesignText: 'white',
              salesPrice: { currencyCode: 'EUR', numeral: 59.99 },
            },
          },
          {
            product: {
              name: 'BILLY',
              typeName: 'Bookcase',
              itemMeasureReferenceText: '80x28x202 cm',
              pipUrl: 'https://www.ikea.com/de/en/p/billy-bookcase-white-00263850/',
              filterClass: 'bookcases and display cabinets',
              itemNo: '00263850',
              itemType: 'ART',
              validDesignText: 'white',
            },
          },
          {
            product: {
              name: 'MALM',
              typeName: 'Bed frame, high',
              itemMeasureReferenceText: '140x200 cm',
              pipUrl: 'https://www.ikea.com/de/en/p/malm-bed-frame-high-white-s29931596/',
              filterClass: 'bed frames',
              itemNo: '29931596',
              itemType: 'SPR',
              validDesignText: 'white',
            },
          },
          {
            product: {
              name: 'MITTZON',
              typeName: 'Desk sit/stand',
              itemMeasureReferenceText: '160x80 cm',
              pipUrl: 'https://www.ikea.com/de/en/p/mittzon-desk-sit-stand-electric-white-s59529966/',
              filterClass: 'desks',
              itemNo: '59529966',
              itemType: 'SPR',
              validDesignText: 'electric white',
            },
          },
          {
            // No class: falls back to the type name.
            product: {
              name: 'ALEFJÄLL',
              typeName: 'Office chair',
              pipUrl: 'https://www.ikea.com/de/en/p/alefjaell-office-chair-smidig-black-20644123/',
              filterClass: '',
              itemNo: '20644123',
              itemType: 'ART',
              validDesignText: 'Smidig black',
            },
          },
          {
            // Hostile URLs must not survive normalization.
            product: {
              name: 'EVIL',
              typeName: 'Table',
              itemMeasureReferenceText: '100x60x75 cm',
              pipUrl: 'javascript:alert(1)',
              mainImageUrl: 'https://tracker.example.com/pixel.jpg',
              filterClass: 'tables',
              itemNo: '12345678',
            },
          },
          { product: { name: 'BROKEN', itemNo: 'abc' } },
          { content: { type: 'PLANNER' } },
          // Duplicate of the first entry.
          { product: { name: 'ALEX', typeName: 'Drawer unit', itemNo: '00473546' } },
        ],
      },
    },
  },
};
