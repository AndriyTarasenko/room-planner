import { Globe, LoaderCircle, RotateCw, X } from 'lucide-react';
import { useState } from 'react';
import { findBuiltInProduct } from '../../catalog/catalog';
import { formatDimensions, productTitle } from '../../catalog/format';
import { placeProduct } from '../../catalog/placeProduct';
import type { FurnitureProduct, LiveCatalogProvider, LiveProductCandidate } from '../../catalog/types';
import { useLiveSearch } from './useLiveSearch';

interface Props {
  provider: LiveCatalogProvider;
  query: string;
  saved: readonly FurnitureProduct[];
  onImport: (candidate: LiveProductCandidate) => void;
}

/** "Search IKEA online" for the current query, and its results. Only runs on click. */
export function LiveSearchSection({ provider, query, saved, onImport }: Props) {
  const { state, search, clear } = useLiveSearch(provider);
  const q = query.trim();
  const showButton = q !== '' && (state.status === 'idle' || state.query !== q);

  if (!showButton && state.status === 'idle') return null;

  return (
    <div className="live-search">
      {showButton && (
        <button type="button" className="live-search-btn" onClick={() => void search(q)} disabled={state.status === 'loading'}>
          <Globe size={14} />
          <span>
            Search {provider.label} online for “{q}”
          </span>
        </button>
      )}

      {state.status !== 'idle' && (
        <div className="live-results" aria-live="polite">
          <div className="library-group-title live-results-title">
            <span>
              {provider.label} online · “{state.query}”
            </span>
            <button type="button" className="icon-btn live-results-close" aria-label="Close online results" title="Close" onClick={clear}>
              <X size={13} />
            </button>
          </div>

          {state.status === 'loading' && (
            <p className="empty-note live-status">
              <LoaderCircle size={13} className="spin" />
              Searching {provider.label}…
            </p>
          )}

          {state.status === 'error' && (
            <div className="notice warning">
              <span>
                {provider.label} online search is currently unavailable. Built-in and saved furniture still work.{' '}
                <button type="button" className="link-btn" onClick={() => void search(state.query)}>
                  <RotateCw size={11} />
                  Try again
                </button>
              </span>
            </div>
          )}

          {state.status === 'done' &&
            (state.results.length === 0 ? (
              <p className="empty-note">No {provider.label} products found.</p>
            ) : (
              <>
                <p className="live-results-hint">From {provider.label}’s website. You confirm the size before a product is added.</p>
                {state.results.map((candidate) => (
                  <LiveResultRow key={candidate.product.id} candidate={candidate} saved={saved} onImport={onImport} />
                ))}
              </>
            ))}
        </div>
      )}
    </div>
  );
}

function LiveResultRow({ candidate, saved, onImport }: { candidate: LiveProductCandidate; saved: readonly FurnitureProduct[]; onImport: (c: LiveProductCandidate) => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { product } = candidate;
  // Verified or already saved data wins over the live listing.
  const known = findBuiltInProduct(product.id) ?? saved.find((p) => p.id === product.id);
  const title = productTitle(product);
  const meta = known
    ? `${known.origin === 'built-in' ? 'Built-in, verified' : 'Saved'} · ${formatDimensions(known)}`
    : candidate.listedSize
      ? `Listed as ${candidate.listedSize}`
      : 'No size listed';

  return (
    <div className="catalog-row">
      <button
        type="button"
        className="catalog-row-main"
        onClick={() => (known ? placeProduct(known) : onImport(candidate))}
        title={known ? `Add ${title} (${formatDimensions(known)})` : `Check the size of ${title} and add it`}
      >
        {product.imageUrl && !imageFailed ? (
          <img className="live-thumb" src={product.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : (
          <span className="live-thumb live-thumb-empty" aria-hidden="true" />
        )}
        <span className="catalog-row-text">
          <span className="catalog-row-name">
            {title}
            {product.variant && <span className="catalog-row-variant">, {product.variant}</span>}
          </span>
          <span className={`catalog-row-meta${known ? ' verified' : ''}`}>{meta}</span>
        </span>
      </button>
    </div>
  );
}
