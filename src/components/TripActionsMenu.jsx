import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Camera, Pencil } from 'lucide-react';

const MENU_ITEMS = [
  { action: 'cover', label: 'Edit cover photo', icon: Camera },
  { action: 'details', label: 'Edit trip', icon: Pencil },
];

// Three-dot menu used on the trip page header and on each trip card on the
// home page. Stops click propagation so it never triggers wrapping <Link>s.
export default function TripActionsMenu({ onEdit, ariaLabel = 'Trip actions' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOut = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOut);
    return () => document.removeEventListener('mousedown', onClickOut);
  }, [open]);

  const handlePick = (action) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    onEdit(action);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={ariaLabel}
        className="w-10 h-10 rounded-full bg-ink-900/60 backdrop-blur-md border border-coral-500/30 text-cream-50 hover:bg-ink-900/80 flex items-center justify-center shadow-md transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 bg-white shadow-lg rounded-lg border border-sage-200 py-1 min-w-[200px] z-30"
          onClick={(e) => e.stopPropagation()}
        >
          {MENU_ITEMS.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              type="button"
              onClick={handlePick(action)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-900 hover:bg-surface-100 transition-colors"
            >
              <Icon className="w-4 h-4 text-coral-500" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
