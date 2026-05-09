import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getAllCountries } from '../lib/countries';

const MAX_RESULTS = 60;

// Free-text input + dropdown of matching countries (flag + name).
// User can pick from the list or type any name as fallback (so countries
// not in our data file still work as plain text).
export default function CountryCombobox({
  value,
  onChange,
  disabled = false,
  placeholder = 'Vietnam',
  autoFocus = false,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const all = getAllCountries();
  const query = (value || '').trim().toLowerCase();
  const matches = query
    ? all.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.code2.includes(query) ||
          c.code3.includes(query),
      )
    : all;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          required
          disabled={disabled}
          autoFocus={autoFocus}
          className="input-field pl-11"
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>

      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface-50 border border-surface-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {matches.slice(0, MAX_RESULTS).map((c) => (
            <button
              key={c.code2}
              type="button"
              onClick={() => {
                onChange(c.name);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-900 hover:bg-surface-100 text-left"
            >
              <span className="text-xl">{c.flag}</span>
              <span className="flex-1">{c.name}</span>
              <span className="text-xs uppercase text-sage-500 font-mono">{c.code2}</span>
            </button>
          ))}
          {matches.length > MAX_RESULTS && (
            <div className="px-3 py-1.5 text-xs text-sage-500 border-t border-surface-200">
              Showing first {MAX_RESULTS} matches — keep typing to narrow down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
