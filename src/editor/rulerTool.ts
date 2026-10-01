/**
 * The Ruler: drag between two points of the plan (or click both ends) to measure the distance.
 * The measurement stays on the plan until the next one starts or the tool is switched off.
 */
import { projectStore } from '../store';
import { useUi } from './uiStore';

export const isMeasuring = () => useUi.getState().tool === 'measure';

export function startMeasuring() {
  projectStore.getState().select(null);
  useUi.getState().setTool('measure');
}

export const stopMeasuring = () => useUi.getState().setTool('select');

export const toggleMeasuring = () => (isMeasuring() ? stopMeasuring() : startMeasuring());

/** Removes the measurement. Returns false when there was none. */
export function clearMeasurement(): boolean {
  const { ruler, updateRuler } = useUi.getState();
  if (!ruler.start) return false;
  updateRuler({ start: null, end: null, phase: 'idle' });
  return true;
}
