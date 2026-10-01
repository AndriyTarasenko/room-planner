import { ExternalLink, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CATALOG_CATEGORIES } from '../../catalog/categories';
import { productTitle } from '../../catalog/format';
import { placeProduct } from '../../catalog/placeProduct';
import { type FurnitureProduct, GENERIC_MANUFACTURER } from '../../catalog/types';
import { useUserCatalog, userCatalogStore } from '../../catalog/userCatalog';
import { formatNumber } from '../../utils/format';
import { safeHttpUrl } from '../../utils/validate';
import { Dialog } from '../ui/Dialog';
import { toast } from '../ui/toastStore';

const ORIGIN_LABEL: Record<FurnitureProduct['origin'], string> = {
  'built-in': 'Built-in catalog',
  user: 'My furniture (this browser)',
  live: 'Online result',
};

/** Where the dimensions come from, in words. */
function dimensionsSource(p: FurnitureProduct): string {
  if (p.manufacturer === GENERIC_MANUFACTURER) return 'Typical size, not a specific product';
  const how = p.metadata?.dimensionsSource;
  const imported = typeof p.metadata?.importedOn === 'string' ? `, saved ${p.metadata.importedOn}` : '';
  if (how === 'listing') return `${p.manufacturer}’s listed size, rounded${imported}`;
  if (how === 'user') return `Entered by you${imported}`;
  if (p.sourceLastVerified) return `Checked against the product page on ${p.sourceLastVerified}`;
  return p.source && !safeHttpUrl(p.source) ? p.source : 'Unknown';
}

export function ProductDetailsDialog({ product, onClose }: { product: FurnitureProduct | null; onClose: () => void }) {
  return (
    <Dialog
      open={product !== null}
      onClose={onClose}
      title={product ? productTitle(product) : ''}
      description={product ? [product.manufacturer, product.variant].filter(Boolean).join(' · ') : undefined}
    >
      {product && <Details key={product.id} product={product} onClose={onClose} />}
    </Dialog>
  );
}

function Details({ product, onClose }: { product: FurnitureProduct; onClose: () => void }) {
  const favorite = useUserCatalog((s) => s.favorites.includes(product.id));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const pageUrl = safeHttpUrl(product.productUrl);
  const measured = typeof product.metadata?.sourceMeasurements === 'string' ? product.metadata.sourceMeasurements : null;
  const height =
    product.heightMax !== undefined ? `${formatNumber(product.height)}–${formatNumber(product.heightMax)}` : formatNumber(product.height);

  const listed = typeof product.metadata?.listedSize === 'string' ? product.metadata.listedSize : null;
  const rows: [string, string][] = [
    ['Category', CATALOG_CATEGORIES[product.category].label],
    ...(product.articleNumber ? [['Article number', product.articleNumber] as [string, string]] : []),
    ...(listed ? [['Sold as', product.category === 'bed' ? `${listed} (mattress size)` : listed] as [string, string]] : []),
    ['Catalog', ORIGIN_LABEL[product.origin]],
    ['Dimensions', dimensionsSource(product)],
  ];

  return (
    <>
      <div className="stat-grid stat-grid-3" aria-label="Dimensions">
        <div>
          <span className="stat-label">Width</span>
          <span className="stat-value">{formatNumber(product.width)} cm</span>
        </div>
        <div>
          <span className="stat-label">Depth</span>
          <span className="stat-value">{formatNumber(product.depth)} cm</span>
        </div>
        <div>
          <span className="stat-label">Height</span>
          <span className="stat-value">{height} cm</span>
        </div>
      </div>

      <dl className="details-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {measured && <p className="details-note">Product page lists: {measured}</p>}

      {(pageUrl || product.imageUrl) && (
        <div className="details-links">
          {product.imageUrl && (
            <img className="details-image" src={product.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" width={56} height={56} />
          )}
          {pageUrl && (
            <a className="about-link" href={pageUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} />
              Product page
              <span className="about-link-url">{new URL(pageUrl).hostname.replace(/^www\./, '')}</span>
            </a>
          )}
        </div>
      )}

      <div className="dialog-footer" style={{ padding: '6px 0 0' }}>
        <button
          type="button"
          className={`icon-btn${favorite ? ' active' : ''}`}
          aria-pressed={favorite}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          data-tip={favorite ? 'Remove from favorites' : 'Add to favorites'}
          data-tip-pos="top"
          onClick={() => userCatalogStore.getState().toggleFavorite(product.id)}
        >
          <Star size={16} fill={favorite ? 'currentColor' : 'none'} />
        </button>
        {product.origin === 'user' && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (!confirmRemove) {
                setConfirmRemove(true);
                return;
              }
              userCatalogStore.getState().removeProduct(product.id);
              toast(`Removed ${productTitle(product)} from My furniture. Placed copies stay in your rooms.`);
              onClose();
            }}
          >
            <Trash2 size={15} />
            {confirmRemove ? 'Click again to remove' : 'Remove'}
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            placeProduct(product);
            onClose();
          }}
        >
          <Plus size={15} />
          Add to room
        </button>
      </div>
    </>
  );
}
