import { AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Trash2 } from 'lucide-react';
import { type Issue, analyzeLayoutCached } from '../furniture/analysis';
import { OPENING_DEFAULTS, OPENING_LIMITS } from '../plan/openings';
import { isMostlyHorizontal, startsAtPlanStart, wallEndLabels, wallFrame, wallNames } from '../plan/walls';
import { projectStore, selectItems, selectRooms, useEditor } from '../store';
import { OPENING_KINDS, type Opening, type OpeningKind, type Room } from '../types';
import { IssueList } from './ItemInspector';
import { OPENING_ICONS } from './planIcons';
import { SharedPlanNote } from './SharedPlanNote';
import { NumberField } from './ui/NumberField';
import { Section, Segmented } from './ui/controls';

/** Properties of the selected door, window or passage. */
export function OpeningInspector({ opening, room }: { opening: Opening; room: Room }) {
  const rooms = useEditor(selectRooms);
  const items = useEditor(selectItems);
  const { updateOpening, deleteOpening, select } = projectStore.getState();
  const update = (patch: Parameters<typeof updateOpening>[1]) => updateOpening(opening.id, patch);

  const frame = wallFrame(room, opening.wall);
  const length = frame.length;
  const names = wallNames(room);
  const ends = wallEndLabels(frame);
  const after = length - opening.offset - opening.width;
  const label = OPENING_DEFAULTS[opening.kind].label;
  // Show both distances, and both hinge sides, in the order they appear on the plan.
  const planOrder = startsAtPlanStart(frame);

  const analysis = analyzeLayoutCached(items, rooms);
  const byId = new Map(items.map((i) => [i.id, i]));
  const issues: Issue[] = analysis.doorConflicts
    .filter((c) => c.openingId === opening.id)
    .map((c) => ({ kind: 'clearance', itemId: c.itemId, message: `${byId.get(c.itemId)?.name || 'Object'} is in the door swing` }));

  const fromStart = (
    <div key="start">
      <span className="field-label">From {ends.start.toLowerCase()} corner</span>
      <NumberField label={`Distance from the ${ends.start.toLowerCase()} corner`} suffix="cm" value={opening.offset} min={0} max={length - opening.width} onCommit={(offset) => update({ offset })} />
    </div>
  );
  const fromEnd = (
    <div key="end">
      <span className="field-label">From {ends.end.toLowerCase()} corner</span>
      <NumberField
        label={`Distance from the ${ends.end.toLowerCase()} corner`}
        suffix="cm"
        value={after}
        min={0}
        max={length - opening.width}
        onCommit={(v) => update({ offset: length - opening.width - v })}
      />
    </div>
  );
  const hingeOptions = [
    { value: 'start' as const, label: ends.start },
    { value: 'end' as const, label: ends.end },
  ];

  return (
    <div>
      <div className="inspector-head">
        <div className="inspector-title">
          {OPENING_ICONS[opening.kind]}
          {label}
        </div>
        <div className="inspector-meta">
          <span>{room.name}</span>
          <span aria-hidden="true">·</span>
          <span>{names[opening.wall]} wall</span>
        </div>
        <div className="inspector-actions">
          <span style={{ flex: 1 }} />
          <button type="button" className="icon-btn danger" data-tip="Delete (Del)" aria-label={`Delete ${label.toLowerCase()}`} onClick={() => deleteOpening(opening.id)}>
            <Trash2 size={16} />
          </button>
        </div>
        <SharedPlanNote />
      </div>

      {issues.length > 0 && (
        <Section>
          <IssueList issues={issues} onSelect={(issue) => select(issue.itemId)} />
        </Section>
      )}

      <Section title="Type">
        <Segmented<OpeningKind>
          label="Type"
          value={opening.kind}
          onChange={(kind) => update({ kind })}
          options={OPENING_KINDS.map((k) => ({ value: k, label: OPENING_DEFAULTS[k].label }))}
        />
      </Section>

      <Section title="Size and position" aside={<span className="section-hint">cm</span>}>
        <div className="stack">
          <div>
            <span className="field-label">Width</span>
            <NumberField label="Opening width" suffix="cm" value={opening.width} min={Math.min(OPENING_LIMITS.min, length)} max={length} onCommit={(width) => update({ width })} />
          </div>
          <div>
            <span className="field-label">Wall</span>
            {room.corners.length <= 4 ? (
              <Segmented<number> label="Wall" value={opening.wall} onChange={(wall) => update({ wall })} options={names.map((name, i) => ({ value: i, label: name }))} />
            ) : (
              <label className="input">
                <select aria-label="Wall" value={opening.wall} onChange={(e) => update({ wall: Number(e.target.value) })}>
                  {names.map((name, i) => (
                    <option key={i} value={i}>
                      {name} wall ({Math.round(wallFrame(room, i).length)} cm)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="grid-2">{planOrder ? [fromStart, fromEnd] : [fromEnd, fromStart]}</div>
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => update({ offset: (length - opening.width) / 2 })}>
              {isMostlyHorizontal(frame) ? <AlignHorizontalJustifyCenter size={14} /> : <AlignVerticalJustifyCenter size={14} />}
              Center on the wall
            </button>
          </div>
        </div>
      </Section>

      {opening.kind === 'door' && (
        <Section title="Door">
          <div className="stack">
            <div>
              <span className="field-label">Hinge</span>
              <Segmented<Opening['hinge']> label="Hinge side" value={opening.hinge} onChange={(hinge) => update({ hinge })} options={planOrder ? hingeOptions : [...hingeOptions].reverse()} />
            </div>
            <div>
              <span className="field-label">Opens</span>
              <Segmented<Opening['swing']>
                label="Opens"
                value={opening.swing}
                onChange={(swing) => update({ swing })}
                options={[
                  { value: 'in', label: `Into ${room.name}`, title: `Swings into ${room.name}` },
                  { value: 'out', label: 'Outward', title: 'Swings into the neighboring room, or outside' },
                ]}
              />
            </div>
          </div>
          <p className="field-note">Furniture in the swing area is flagged, like a blocked clearance.</p>
        </Section>
      )}
    </div>
  );
}
