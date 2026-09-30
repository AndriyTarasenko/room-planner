import { type KeyboardEvent, useRef, useState } from 'react';
import { useCommitOnUnmount } from '../../hooks/useCommitOnUnmount';
import { formatNumber } from '../../utils/format';
import { parseNumberInput } from '../../utils/parseNumber';

interface Props {
  value: number;
  onCommit: (value: number) => void;
  label: string;
  /** Short label shown inside the field (e.g. "W"); `label` is used for accessibility. */
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  title?: string;
}

/**
 * Numeric input that commits on Enter or blur (one undo step per edit), reverts on Escape,
 * steps with ↑/↓ (Shift ×10) and accepts arithmetic like "180+20".
 */
export function NumberField({
  value,
  onCommit,
  label,
  prefix,
  suffix,
  min = -Infinity,
  max = Infinity,
  step = 1,
  decimals = 1,
  title,
}: Props) {
  const [draft, setDraftState] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const draftRef = useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    draftRef.current = next;
    setDraftState(next);
  };

  const clamp = (v: number) => {
    const f = 10 ** decimals;
    return Math.min(max, Math.max(min, Math.round(v * f) / f));
  };

  useCommitOnUnmount(draftRef, (text) => {
    const parsed = parseNumberInput(text);
    if (!Number.isNaN(parsed) && clamp(parsed) !== value) onCommit(clamp(parsed));
  });

  const commit = (text: string) => {
    const parsed = parseNumberInput(text);
    if (Number.isNaN(parsed)) {
      setInvalid(true);
      setDraft(null);
      setTimeout(() => setInvalid(false), 600);
      return;
    }
    const next = clamp(parsed);
    setDraft(null);
    if (next !== value) onCommit(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit(e.currentTarget.value);
      e.currentTarget.select();
    } else if (e.key === 'Escape') {
      setDraft(null);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = draft !== null && !Number.isNaN(parseNumberInput(draft)) ? parseNumberInput(draft) : value;
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
      const next = clamp(base + delta);
      setDraft(null);
      if (next !== value) onCommit(next);
    }
  };

  return (
    <label className={`input${invalid ? ' invalid' : ''}`} title={title}>
      {prefix && <span className="input-prefix">{prefix}</span>}
      <input
        aria-label={label}
        inputMode="decimal"
        value={draft ?? formatNumber(value, decimals)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => {
          if (draft !== null) commit(e.target.value);
        }}
        onKeyDown={onKeyDown}
      />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </label>
  );
}
