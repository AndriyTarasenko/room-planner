import { Info, Star } from 'lucide-react';
import { itemCategoryFor } from '../../catalog/categories';
import { formatDimensions, productMeta, productTitle } from '../../catalog/format';
import { endProductDrag, placeProduct, startProductDrag } from '../../catalog/placeProduct';
import type { FurnitureProduct } from '../../catalog/types';
import { useUserCatalog, userCatalogStore } from '../../catalog/userCatalog';
import { CATEGORIES } from '../../furniture/categories';
import { shade } from '../../utils/color';

/** Proportional top-down footprint thumbnail. */
export function ProductGlyph({ product }: { product: Pick<FurnitureProduct, 'width' | 'depth' | 'category' | 'kind' | 'shape' | 'defaultColor'> }) {
  const box = 16;
  const ratio = product.width / product.depth;
  const w = ratio >= 1 ? box : Math.max(4, box * ratio);
  const h = ratio >= 1 ? Math.max(4, box / ratio) : box;
  const x = (box - w) / 2 + 0.5;
  const y = (box - h) / 2 + 0.5;
  const color = product.defaultColor ?? CATEGORIES[itemCategoryFor(product.category)].color;
  const stroke = shade(color, 0.4);
  if (product.shape?.kind === 'round') {
    return (
      <svg width={17} height={17} aria-hidden="true" className="glyph">
        <ellipse cx={x + (w - 1) / 2} cy={y + (h - 1) / 2} rx={(w - 1) / 2} ry={(h - 1) / 2} fill={color} stroke={stroke} strokeWidth={1} />
      </svg>
    );
  }
  if (product.shape?.kind === 'l') {
    const s = h * (product.shape.segment / product.depth);
    const points = `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x + w - s},${y + h} ${x + w - s},${y + s} ${x},${y + s}`;
    return (
      <svg width={17} height={17} aria-hidden="true" className="glyph">
        <polygon points={points} fill={color} stroke={stroke} strokeWidth={1} />
      </svg>
    );
  }
  const radius = product.kind === 'office-chair' ? 4 : 1;
  return (
    <svg width={17} height={17} aria-hidden="true" className="glyph">
      <rect x={x} y={y} width={w - 1} height={h - 1} rx={radius} fill={color} stroke={stroke} strokeWidth={1} />
    </svg>
  );
}

interface Props {
  product: FurnitureProduct;
  onDetails: (product: FurnitureProduct) => void;
}

/** One catalog entry: click or drag to add; star to favorite; ⓘ for details. */
export function ProductRow({ product, onDetails }: Props) {
  const favorite = useUserCatalog((s) => s.favorites.includes(product.id));
  const title = productTitle(product);
  const meta = productMeta(product);

  return (
    <div className="catalog-row">
      <button
        type="button"
        className="catalog-row-main"
        draggable
        onDragStart={(e) => startProductDrag(e, product)}
        onDragEnd={endProductDrag}
        onClick={() => placeProduct(product)}
        title={`Add ${title} (${formatDimensions(product)})`}
      >
        <ProductGlyph product={product} />
        <span className="catalog-row-text">
          <span className="catalog-row-line">
            <span className="catalog-row-name">{title}</span>
            {favorite && <Star size={10} className="catalog-fav-mark" fill="currentColor" aria-label="Favorite" />}
          </span>
          <span className="catalog-row-meta">
            {product.origin === 'user' && <span className="catalog-tag">Mine</span>}
            {meta}
          </span>
        </span>
      </button>
      {/* Shown over the end of the row on hover or keyboard focus, so names keep their full width. */}
      <span className="catalog-row-actions">
        <button
          type="button"
          className={`catalog-row-icon${favorite ? ' on' : ''}`}
          aria-pressed={favorite}
          aria-label={favorite ? `Remove ${title} from favorites` : `Add ${title} to favorites`}
          title={favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => userCatalogStore.getState().toggleFavorite(product.id)}
        >
          <Star size={13} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className="catalog-row-icon" aria-label={`Details for ${title}`} title="Details" onClick={() => onDetails(product)}>
          <Info size={13} />
        </button>
      </span>
    </div>
  );
}
