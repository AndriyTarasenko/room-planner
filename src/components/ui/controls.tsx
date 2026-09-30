import { type ReactNode, useRef, useState } from 'react';
import { useCommitOnUnmount } from '../../hooks/useCommitOnUnmount';

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
  );
}

interface SegmentedProps<T extends string | number> {
  options: readonly { value: T; label: ReactNode; title?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  label: string;
}

export function Segmented<T extends string | number>({ options, value, onChange, label }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface TextFieldProps {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  maxLength?: number;
}

/** Text input that commits on blur/Enter so each edit is a single undo step. */
export function TextField({ value, onCommit, label, placeholder, className = 'text-input', multiline, maxLength }: TextFieldProps) {
  const [draft, setDraftState] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const setDraft = (next: string | null) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  useCommitOnUnmount(draftRef, (pending) => {
    if (pending !== value) onCommit(pending);
  });
  const common = {
    'aria-label': label,
    className,
    placeholder,
    maxLength,
    value: draft ?? value,
    onBlur: commit,
  };
  if (multiline) {
    return (
      <textarea
        {...common}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
      />
    );
  }
  return (
    <input
      {...common}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function Section({ title, aside, children }: { title?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {(title || aside) && (
        <div className="section-header">
          {title && <h3 className="section-title" style={{ margin: 0 }}>{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
