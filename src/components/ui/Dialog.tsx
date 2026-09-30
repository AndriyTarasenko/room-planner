import { type FormEvent, type ReactNode, useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer content; wrap submit buttons with `type="submit"` to submit on Enter. */
  footer?: ReactNode;
  onSubmit?: () => void;
}

/** Modal dialog built on the native <dialog> element (focus trap and Escape for free). */
export function Dialog({ open, onClose, title, description, children, footer, onSubmit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        // Click on the backdrop closes the dialog.
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <form onSubmit={handleSubmit}>
          <div className="dialog-header">
            <h2 className="dialog-title">{title}</h2>
            {description && <p className="dialog-desc">{description}</p>}
          </div>
          {children && <div className="dialog-body">{children}</div>}
          {footer && <div className="dialog-footer">{footer}</div>}
        </form>
      )}
    </dialog>
  );
}
