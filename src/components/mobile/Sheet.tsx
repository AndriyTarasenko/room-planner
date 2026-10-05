import { X } from 'lucide-react';
import { type PointerEvent, type ReactNode, useRef, useState } from 'react';
import { type SheetId, useSheet } from './sheetStore';

/** How far the head must be pulled, in px, to close, collapse or expand the sheet. */
const PULL = 56;
/** A press that moves less than this is a tap. */
const TAP_SLOP = 6;

interface Props {
  id: SheetId;
  title: ReactNode;
  children: ReactNode;
  /** `tall` sheets keep their height while their content changes (a list being searched). */
  size?: 'auto' | 'tall';
  /** Stays mounted while closed after it first opened, so it keeps its state (a search). */
  keepMounted?: boolean;
}

/**
 * A panel that slides up from the bottom bar (on a wide, short screen: in from the right). In a
 * `.sheet-layer` it covers the canvas; in the `.sheet-dock` the canvas makes room for it. Its
 * head is a handle: pull it down to close, up to expand, or tap it to switch between the two
 * heights.
 */
export function Sheet({ id, title, children, size = 'auto', keepMounted = false }: Props) {
  const open = useSheet((s) => s.open === id);
  const expanded = useSheet((s) => s.open === id && s.expanded);
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  const ref = useRef<HTMLElement>(null);
  const pull = useRef<{ y: number; dy: number } | null>(null);

  if (!open && !(keepMounted && opened)) return null;

  const follow = (dy: number) => {
    if (ref.current) ref.current.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
  };
  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pull.current = { y: e.clientY, dy: 0 };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pull.current) return;
    pull.current.dy = e.clientY - pull.current.y;
    follow(pull.current.dy);
  };
  const onPointerUp = () => {
    const dy = pull.current?.dy;
    pull.current = null;
    follow(0);
    if (dy === undefined) return;
    const { setExpanded, close } = useSheet.getState();
    if (Math.abs(dy) < TAP_SLOP) setExpanded(!expanded);
    else if (dy > PULL) {
      if (expanded) setExpanded(false);
      else close();
    } else if (dy < -PULL) setExpanded(true);
  };

  return (
    <section
      ref={ref}
      className={`sheet sheet-${id}${size === 'tall' ? ' sheet-tall' : ''}${expanded ? ' expanded' : ''}`}
      hidden={!open}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div className="sheet-head" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-title-row">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => useSheet.getState().close()}>
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
