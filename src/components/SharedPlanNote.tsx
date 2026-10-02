import { Link2, Unlink } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { selectActiveLayout, selectPlanSharedWith, useEditor } from '../store';
import { layoutNames, unlinkLayoutPlan } from './projectActions';

/**
 * Shown while the active layout shares its floor plan with other layouts, so a moved wall
 * showing up there too is no surprise, with a button to give this layout its own copy.
 */
export function SharedPlanNote() {
  const sharedWith = useEditor(useShallow(selectPlanSharedWith));
  const layout = useEditor(selectActiveLayout);
  if (sharedWith.length === 0) return null;
  const names = layoutNames(sharedWith);
  return (
    <div className="plan-share-note">
      <Link2 size={14} aria-hidden="true" />
      <span className="plan-share-text" title={`Room, wall, door and window changes also show in ${names}.`}>
        Floor plan shared with {names}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        data-tip={`Give “${layout.name}” its own copy of the floor plan`}
        data-tip-align="end"
        onClick={() => unlinkLayoutPlan(layout.id)}
      >
        <Unlink size={13} />
        Unlink
      </button>
    </div>
  );
}
