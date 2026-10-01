import { ChevronDown, ChevronRight, Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BUILT_IN_PRODUCTS, findProduct, manufacturersOf } from '../../catalog/catalog';
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_ORDER } from '../../catalog/categories';
import { LIVE_PROVIDERS } from '../../catalog/providers';
import { type CatalogFilter, NO_FILTER, filterProducts, groupByCategory, isFiltering } from '../../catalog/search';
import type { CatalogCategory, FurnitureProduct, LiveProductCandidate } from '../../catalog/types';
import { useUserCatalog } from '../../catalog/userCatalog';
import { CustomFurnitureDialog } from '../CustomFurnitureDialog';
import { ImportProductDialog } from './ImportProductDialog';
import { LiveSearchSection } from './LiveSearchSection';
import { ProductDetailsDialog } from './ProductDetailsDialog';
import { ProductRow } from './ProductRow';

const isDefined = <T,>(v: T | undefined): v is T => v !== undefined;

/** The furniture sidebar: search, filters, recently used, the catalog and optional online search. */
export function FurnitureBrowser() {
  const [filter, setFilter] = useState<CatalogFilter>(NO_FILTER);
  const [details, setDetails] = useState<FurnitureProduct | null>(null);
  const [importing, setImporting] = useState<LiveProductCandidate | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);

  const saved = useUserCatalog((s) => s.products);
  const favorites = useUserCatalog((s) => s.favorites);
  const recent = useUserCatalog((s) => s.recent);

  const all = useMemo(() => [...BUILT_IN_PRODUCTS, ...saved], [saved]);
  const manufacturers = useMemo(() => manufacturersOf(all), [all]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  // A manufacturer can vanish (last saved product removed); fall back to "all" then.
  const effective = useMemo(
    () => (filter.manufacturer && !manufacturers.includes(filter.manufacturer) ? { ...filter, manufacturer: null } : filter),
    [filter, manufacturers],
  );
  const results = useMemo(() => filterProducts(all, effective, favoriteSet), [all, effective, favoriteSet]);
  const groups = useMemo(() => groupByCategory(results), [results]);
  const recentProducts = useMemo(() => recent.map((id) => findProduct(id, saved)).filter(isDefined), [recent, saved]);
  const filtering = isFiltering(effective);
  const set = (patch: Partial<CatalogFilter>) => setFilter((f) => ({ ...f, ...patch }));

  const emptyNote = effective.favoritesOnly && favorites.length === 0
    ? 'No favorites yet. Use the star on any item to keep it here.'
    : effective.origin === 'user' && saved.length === 0
      ? 'Nothing saved yet. Products you add from an online search, and custom objects you save, appear here.'
      : effective.query.trim()
        ? `No furniture matches “${effective.query.trim()}”.`
        : 'No furniture matches these filters.';

  return (
    <>
      <div className="section library">
        <div className="section-header">
          <h3 className="section-title" style={{ margin: 0 }}>
            Furniture
          </h3>
          <span className="section-hint">{filtering ? `${results.length} found` : 'Click or drag to add'}</span>
        </div>

        <label className="input library-search">
          <Search size={13} style={{ color: 'var(--text-3)', marginRight: 6, flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Search furniture..."
            aria-label="Search furniture"
            value={filter.query}
            onChange={(e) => set({ query: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && filter.query) {
                e.stopPropagation();
                set({ query: '' });
              }
            }}
          />
        </label>

        <div className="library-filters">
          <select
            className="select select-compact"
            aria-label="Filter by manufacturer"
            title="Manufacturer"
            value={effective.manufacturer ?? ''}
            onChange={(e) => set({ manufacturer: e.target.value || null })}
          >
            <option value="">All makers</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="select select-compact"
            aria-label="Filter by category"
            title="Category"
            value={effective.category ?? ''}
            onChange={(e) => set({ category: (e.target.value || null) as CatalogCategory | null })}
          >
            <option value="">All categories</option>
            {CATALOG_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATALOG_CATEGORIES[c].label}
              </option>
            ))}
          </select>
        </div>
        <div className="library-chips" role="group" aria-label="Show">
          <button type="button" className="chip chip-sm" aria-pressed={effective.favoritesOnly} onClick={() => set({ favoritesOnly: !filter.favoritesOnly })}>
            <Star size={12} fill={effective.favoritesOnly ? 'currentColor' : 'none'} />
            Favorites
            {favorites.length > 0 && <span className="chip-count">{favoriteSet.size}</span>}
          </button>
          <button
            type="button"
            className="chip chip-sm"
            aria-pressed={effective.origin === 'user'}
            onClick={() => set({ origin: filter.origin === 'user' ? null : 'user' })}
          >
            My furniture
            {saved.length > 0 && <span className="chip-count">{saved.length}</span>}
          </button>
          {filtering && (
            <button type="button" className="link-btn library-clear" aria-label="Clear search and filters" onClick={() => setFilter(NO_FILTER)}>
              Clear
            </button>
          )}
        </div>

        {!filtering && recentProducts.length > 0 && (
          <div className="library-group">
            <button type="button" className="library-group-title library-group-toggle" aria-expanded={recentOpen} onClick={() => setRecentOpen((o) => !o)}>
              {recentOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Recently used
            </button>
            {recentOpen && recentProducts.map((p) => <ProductRow key={`recent-${p.id}`} product={p} onDetails={setDetails} />)}
          </div>
        )}

        {groups.map(({ category, products }) => (
          <div className="library-group" key={category}>
            <div className="library-group-title">{CATALOG_CATEGORIES[category].plural}</div>
            {products.map((p) => (
              <ProductRow key={p.id} product={p} onDetails={setDetails} />
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className="empty-note">{emptyNote}</p>}

        {LIVE_PROVIDERS.map((provider) => (
          <LiveSearchSection key={provider.id} provider={provider} query={filter.query} saved={saved} onImport={setImporting} />
        ))}
      </div>
      <div className="library-footer">
        <button type="button" className="btn btn-secondary btn-block" onClick={() => setCustomOpen(true)}>
          <Plus size={15} />
          Custom object
        </button>
      </div>
      <CustomFurnitureDialog open={customOpen} onClose={() => setCustomOpen(false)} />
      <ProductDetailsDialog product={details} onClose={() => setDetails(null)} />
      <ImportProductDialog candidate={importing} onClose={() => setImporting(null)} />
    </>
  );
}
