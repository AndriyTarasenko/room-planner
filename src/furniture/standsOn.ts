import type { Placement } from '../types';

/**
 * Where an object stands, as the inspector and the dialogs offer it: always on the floor,
 * always on furniture, or `both`: on furniture when dropped onto it, on the floor elsewhere.
 */
export type StandsOn = Placement | 'both';

export const STANDS_ON_CHOICES: readonly { value: StandsOn; label: string; title: string }[] = [
  { value: 'floor', label: 'Floor', title: 'Stands on the floor' },
  { value: 'surface', label: 'Furniture', title: 'Sits on a desk or sideboard, like a monitor' },
  { value: 'both', label: 'Both', title: 'Floor or furniture, wherever you drop it, like a plant or a lamp' },
];

export const standsOnOf = (p: { placement?: Placement; flexiblePlacement?: boolean }): StandsOn =>
  p.flexiblePlacement ? 'both' : (p.placement ?? 'floor');

/** The placement fields for a choice. `both` keeps `current`, where the object stands now. */
export function applyStandsOn(choice: StandsOn, current: Placement = 'floor'): { placement: Placement; flexiblePlacement: boolean } {
  return choice === 'both' ? { placement: current, flexiblePlacement: true } : { placement: choice, flexiblePlacement: false };
}
