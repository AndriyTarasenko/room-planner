import type { DragEvent } from 'react';
import type { Point } from '../geometry/rect';
import { projectStore } from '../store';
import type { FurnitureProduct } from './types';
import { userCatalogStore } from './userCatalog';

/** Adds a catalog product to the active layout and remembers it as recently used. */
export function placeProduct(product: FurnitureProduct, at?: Point): string {
  const id = projectStore.getState().addProduct(product, at);
  userCatalogStore.getState().markUsed(product.id);
  return id;
}

/** Drag type of furniture browser rows, checked by the canvas before accepting a drop. */
export const PRODUCT_DRAG_TYPE = 'application/x-room-planner-product';

// The product being dragged. Drags only happen within this page, so there is no need to
// serialize it into the DataTransfer (which only carries the id as a consistency check).
let dragged: FurnitureProduct | null = null;

export function startProductDrag(e: DragEvent, product: FurnitureProduct) {
  dragged = product;
  e.dataTransfer.setData(PRODUCT_DRAG_TYPE, product.id);
  e.dataTransfer.effectAllowed = 'copy';
}

export function endProductDrag() {
  dragged = null;
}

/** The product dropped with this DataTransfer, if it came from the furniture browser. */
export function droppedProduct(data: DataTransfer): FurnitureProduct | null {
  const id = data.getData(PRODUCT_DRAG_TYPE);
  return dragged && dragged.id === id ? dragged : null;
}
