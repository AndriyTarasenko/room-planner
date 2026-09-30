import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface MenuProps {
  /** Renders the trigger; call `toggle` from its click handler. */
  trigger: (props: { toggle: () => void; open: boolean }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'start' | 'end';
}

/** Minimal popover menu, portalled to body and closed on outside click, Escape or resize. */
export function Menu({ trigger, children, align = 'start' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = menuRef.current?.offsetWidth ?? 190;
    const left = align === 'end' ? rect.right - width : rect.left;
    setPos({ top: rect.bottom + 4, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !anchorRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span className="menu-anchor" ref={anchorRef}>
      {trigger({ toggle: () => setOpen((o) => !o), open })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="menu"
            role="menu"
            style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </span>
  );
}

interface MenuItemProps {
  icon?: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function MenuItem({ icon, children, onSelect, danger, disabled }: MenuItemProps) {
  return (
    <button type="button" role="menuitem" className={`menu-item${danger ? ' danger' : ''}`} disabled={disabled} onClick={onSelect}>
      {icon}
      {children}
    </button>
  );
}

export const MenuSeparator = () => <div className="menu-sep" role="separator" />;
