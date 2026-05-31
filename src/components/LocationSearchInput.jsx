import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { getISOCode } from '../lib/countries';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Mapbox-backed location autocomplete. Calls the Geocoding API as the user
// types and shows up to 5 suggestions; picking one fills the input AND saves
// coords + place_name back via onSelect.
//
// Props:
//   value: string — display text in the input
//   onChange(name): called on every keystroke (parent owns the text state)
//   onSelect({name, coords, country}): called when a suggestion is picked
//   onClear(): called when the user hits the × button
//   country: trip country (used to bias geocoding results)
//   placeholder, className: passed through to the input
export default function LocationSearchInput({
  value,
  onChange,
  onSelect,
  onClear,
  country,
  placeholder = 'Place name',
  className = '',
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);
  const lastQueryRef = useRef('');

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = (value || '').trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (trimmed === lastQueryRef.current) return;
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(trimmed);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, country]);

  async function fetchSuggestions(query) {
    if (!MAPBOX_TOKEN) return;
    setLoading(true);
    lastQueryRef.current = query;
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        autocomplete: 'true',
        limit: '5',
      });
      const iso = getISOCode(country);
      if (iso) params.set('country', iso);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Geocoding error');
      const data = await res.json();
      // Only show suggestions if the query is still current (race protection).
      if (query !== lastQueryRef.current) return;
      setSuggestions(data.features || []);
      setOpen(true);
    } catch (err) {
      console.warn('Location search failed:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  function pickSuggestion(feature) {
    const [lng, lat] = feature.center;
    const countryFromContext = (feature.context || []).find((c) => c.id?.startsWith('country.'))?.text;
    onSelect?.({
      name: feature.place_name || feature.text,
      shortName: feature.text,
      coords: { lat, lng },
      country: countryFromContext || null,
    });
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => {
            onChange?.(e.target.value);
            setOpen(true);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="input-field h-12 pr-9"
          placeholder={placeholder}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-coral-500" />
        ) : value ? (
          <button
            type="button"
            onClick={() => {
              onChange?.('');
              onClear?.();
              setSuggestions([]);
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-sage-500 hover:text-coral-500"
            aria-label="Clear location"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-surface-50 border border-surface-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickSuggestion(s)}
              className="w-full text-left px-3 py-2.5 hover:bg-surface-100 border-b border-surface-200 last:border-0 flex items-start gap-2"
            >
              <MapPin className="w-4 h-4 text-coral-500/70 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-900 truncate font-medium">{s.text}</p>
                <p className="text-xs text-sage-600 truncate">{s.place_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
