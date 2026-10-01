import { Download, ExternalLink } from 'lucide-react';
import { APP_INFO } from '../appInfo';
import { BUILT_IN_PRODUCTS, CATALOG_METADATA } from '../catalog/catalog';
import { GENERIC_MANUFACTURER } from '../catalog/types';

const genericCount = BUILT_IN_PRODUCTS.filter((p) => p.manufacturer === GENERIC_MANUFACTURER).length;
const productCount = BUILT_IN_PRODUCTS.length - genericCount;
import { exportProject } from './projectActions';
import { Dialog } from './ui/Dialog';

/** Version, where projects are stored, and the source link (when configured at build time). */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { version, commit, repositoryUrl } = APP_INFO;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="About Room Planner"
      description={
        <span className="num">
          Version {version}
          {commit && ` · build ${commit}`}
        </span>
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              exportProject();
              onClose();
            }}
          >
            <Download size={15} />
            Export JSON
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div className="about-block">
        <h3 className="about-heading">Your projects stay in this browser</h3>
        <p>
          Rooms and layouts are saved to this browser’s local storage on this device. Nothing is uploaded, and projects don’t sync to other
          browsers or computers. Clearing this site’s data deletes them.
        </p>
        <p>Use Export JSON for backups or to move a project to another computer, then Import it there.</p>
      </div>
      <div className="about-block">
        <h3 className="about-heading">Furniture catalog</h3>
        <p className="num">
          Built-in catalog {CATALOG_METADATA.version}, updated {CATALOG_METADATA.lastUpdated}: {genericCount} generic items and {productCount} IKEA
          products with dimensions checked against IKEA Germany’s product pages.
        </p>
        <p>
          Placed furniture keeps its own dimensions, so rooms don’t change when the catalog does. IKEA online search uses IKEA’s public website
          search, which is unofficial and may stop working; everything else works without it.
        </p>
      </div>
      {repositoryUrl && (
        <a className="about-link" href={repositoryUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} />
          Source code
          <span className="about-link-url">{repositoryUrl.replace(/^https?:\/\//, '')}</span>
        </a>
      )}
    </Dialog>
  );
}
