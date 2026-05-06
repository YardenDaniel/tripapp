import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import exifr from 'exifr';
import {
  Upload, MapPin, Loader2, X, Play, Navigation, Trash2,
  AlertTriangle, Check, ChevronLeft, ChevronRight, ArrowLeft, Clock, Pencil, MoreVertical,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAP_STYLE = 'mapbox://styles/mapbox/outdoors-v12';

const COUNTRY_CENTERS = {
  Vietnam: { lat: 21.0285, lng: 105.8542, zoom: 5.5 },
  Thailand: { lat: 13.7563, lng: 100.5018, zoom: 5.5 },
  Japan: { lat: 35.6762, lng: 139.6503, zoom: 5 },
  Italy: { lat: 41.9028, lng: 12.4964, zoom: 5 },
  Greece: { lat: 37.9838, lng: 23.7275, zoom: 6 },
  Portugal: { lat: 38.7223, lng: -9.1393, zoom: 6 },
  Israel: { lat: 31.7683, lng: 35.2137, zoom: 7 },
  Egypt: { lat: 26.8206, lng: 30.8025, zoom: 5 },
};

const COUNTRY_ALIASES = {
  'ויאטנם': 'Vietnam', 'תאילנד': 'Thailand', 'יפן': 'Japan',
  'איטליה': 'Italy', 'יוון': 'Greece', 'פורטוגל': 'Portugal',
  'ישראל': 'Israel', 'מצרים': 'Egypt', 'siani': 'Egypt', 'sinai': 'Egypt',
};

function normalizeCountryName(name) {
  if (!name) return name;
  return COUNTRY_ALIASES[name.toLowerCase()] || COUNTRY_ALIASES[name] || name;
}

function parseCoords(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && raw.lat !== undefined && raw.lng !== undefined) return raw;
  if (typeof raw === 'object' && raw.coordinates && Array.isArray(raw.coordinates)) {
    return { lng: raw.coordinates[0], lat: raw.coordinates[1] };
  }
  if (typeof raw === 'string') {
    const wktMatch = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (wktMatch) return { lng: parseFloat(wktMatch[1]), lat: parseFloat(wktMatch[2]) };
    if (/^[0-9A-Fa-f]+$/.test(raw) && raw.length >= 50) {
      try { return parseWKBHex(raw); } catch (e) { console.error(e); }
    }
  }
  return null;
}

function parseWKBHex(hex) {
  const headerLen = 18;
  const xHex = hex.substring(headerLen, headerLen + 16);
  const yHex = hex.substring(headerLen + 16, headerLen + 32);
  const lng = hexToDouble(xHex);
  const lat = hexToDouble(yHex);
  if (isNaN(lng) || isNaN(lat)) return null;
  return { lat, lng };
}

function hexToDouble(hex) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  for (let i = 0; i < 8; i++) {
    view.setUint8(i, parseInt(hex.substring(i * 2, i * 2 + 2), 16));
  }
  return view.getFloat64(0, true);
}

function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    const timeoutId = setTimeout(() => resolve(null), 10000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (error) => {
        clearTimeout(timeoutId);
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

async function reverseGeocode(lat, lng) {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=country,place,locality&language=en&limit=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const countryContext = feature.context?.find((c) => c.id?.startsWith('country.'));
    return {
      country: countryContext?.text || feature.text,
      placeName: feature.place_name,
    };
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
    return null;
  }
}

// Searches Mapbox for matches to `query`. Returns up to 5 suggestions.
// `opts.signal` (AbortSignal), `opts.proximity` ({lat, lng}), `opts.country` (ISO 2-letter), `opts.sessionToken`.
async function forwardGeocode(query, opts = {}) {
  if (!MAPBOX_TOKEN || !query || !query.trim()) return [];
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      limit: '5',
      language: 'en',
    });
    if (opts.sessionToken) params.set('session_token', opts.sessionToken);
    if (opts.proximity) params.set('proximity', `${opts.proximity.lng},${opts.proximity.lat}`);
    if (opts.country) params.set('country', opts.country);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
    const response = await fetch(url, { signal: opts.signal });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.features || [])
      .filter((f) => Array.isArray(f.center) && f.center.length === 2)
      .map((f) => ({
        id: f.id,
        placeName: f.place_name,
        coords: { lng: f.center[0], lat: f.center[1] },
      }));
  } catch (err) {
    if (err.name !== 'AbortError') console.warn('Forward geocode failed:', err);
    return [];
  }
}

const TRIP_COUNTRY_ISO = {
  Vietnam: 'vn', Thailand: 'th', Japan: 'jp', Italy: 'it',
  Greece: 'gr', Portugal: 'pt', Israel: 'il', Egypt: 'eg',
};
function tripCountryISO(name) {
  if (!name) return undefined;
  return TRIP_COUNTRY_ISO[name];
}

// Distance between two coords in meters (Haversine)
function distanceMeters(c1, c2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(c2.lat - c1.lat);
  const dLng = toRad(c2.lng - c1.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Cluster radius in meters based on map zoom (smaller radius at higher zoom)
function clusterRadiusForZoom(zoom) {
  // At zoom 18 (street level): ~10 meters
  // At zoom 15 (neighborhood): ~50 meters
  // At zoom 12 (city): ~500 meters
  // At zoom 8 (region): ~10 km
  // At zoom 5 (country): ~100 km
  return Math.max(10, 50 * Math.pow(2, 15 - zoom));
}

// Group memories into clusters by proximity
function clusterMemories(memories, zoom) {
  const radius = clusterRadiusForZoom(zoom);
  const clusters = [];
  const visited = new Set();

  memories.forEach((mem, i) => {
    if (visited.has(i)) return;
    const cluster = { coords: mem.coords, memories: [mem] };
    visited.add(i);

    memories.forEach((other, j) => {
      if (i === j || visited.has(j)) return;
      if (distanceMeters(mem.coords, other.coords) <= radius) {
        cluster.memories.push(other);
        visited.add(j);
      }
    });

    // Center of cluster = average of all coords
    if (cluster.memories.length > 1) {
      cluster.coords = {
        lat: cluster.memories.reduce((s, m) => s + m.coords.lat, 0) / cluster.memories.length,
        lng: cluster.memories.reduce((s, m) => s + m.coords.lng, 0) / cluster.memories.length,
      };
    }
    clusters.push(cluster);
  });

  return clusters;
}

// Calculate bounding box from memories
function calculateBounds(memories) {
  if (memories.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  memories.forEach((m) => {
    if (m.coords.lat < minLat) minLat = m.coords.lat;
    if (m.coords.lat > maxLat) maxLat = m.coords.lat;
    if (m.coords.lng < minLng) minLng = m.coords.lng;
    if (m.coords.lng > maxLng) maxLng = m.coords.lng;
  });
  return { minLat, maxLat, minLng, maxLng };
}

// Reads an MP4 box header at `pos`. Returns null if header is incomplete or invalid.
function readMP4BoxHeader(view, pos, end) {
  if (pos + 8 > end) return null;
  let size = view.getUint32(pos);
  let headerSize = 8;
  if (size === 1) {
    // 64-bit size lives in the next 8 bytes.
    if (pos + 16 > end) return null;
    const high = view.getUint32(pos + 8);
    const low = view.getUint32(pos + 12);
    size = high * 4294967296 + low;
    headerSize = 16;
  } else if (size === 0) {
    size = end - pos;
  }
  if (size < headerSize) return null;
  const type = String.fromCharCode(
    view.getUint8(pos + 4),
    view.getUint8(pos + 5),
    view.getUint8(pos + 6),
    view.getUint8(pos + 7),
  );
  return { type, size, payloadStart: pos + headerSize, payloadEnd: pos + size };
}

function findMP4Box(view, start, end, targetType) {
  let pos = start;
  while (pos < end) {
    const box = readMP4BoxHeader(view, pos, end);
    if (!box || box.size <= 0) return null;
    if (box.type === targetType) return box;
    pos += box.size;
  }
  return null;
}

// Parses an ISO 6709 location string like "+34.0522-118.2437/" or "+34.0522-118.2437+010.500/".
function parseISO6709(str) {
  const match = str.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

// Lists the type of every direct child of a box, for debugging.
function listChildTypes(view, parent) {
  const types = [];
  let pos = parent.payloadStart;
  while (pos < parent.payloadEnd) {
    const box = readMP4BoxHeader(view, pos, parent.payloadEnd);
    if (!box || box.size <= 0) break;
    types.push(box.type);
    pos += box.size;
  }
  return types;
}

// Reads GPS from the legacy "©xyz" atom inside a parent box (typically moov > udta).
function findXyzLocation(view, buffer, parent) {
  const xyzType = String.fromCharCode(0xa9) + 'xyz';
  const xyz = findMP4Box(view, parent.payloadStart, parent.payloadEnd, xyzType);
  if (!xyz || xyz.payloadEnd - xyz.payloadStart < 4) return null;
  const strLen = view.getUint16(xyz.payloadStart);
  const strStart = xyz.payloadStart + 4;
  if (strStart + strLen > xyz.payloadEnd) return null;
  const isoStr = new TextDecoder('utf-8').decode(buffer.slice(strStart, strStart + strLen));
  return parseISO6709(isoStr);
}

// Reads GPS from the newer "meta > keys + ilst" structure (iPhone iOS 10+).
function findKeysIlstLocation(view, buffer, parent) {
  const meta = findMP4Box(view, parent.payloadStart, parent.payloadEnd, 'meta');
  if (!meta) return null;

  // QuickTime "meta" has a 4-byte version+flags prefix; ISO-MP4 "meta" does not.
  // Try both: child boxes start at payloadStart or payloadStart + 4.
  for (const skipFlags of [0, 4]) {
    const start = meta.payloadStart + skipFlags;
    if (start + 8 > meta.payloadEnd) continue;
    const keys = findMP4Box(view, start, meta.payloadEnd, 'keys');
    const ilst = findMP4Box(view, start, meta.payloadEnd, 'ilst');
    if (!keys || !ilst) continue;

    // Parse the keys list (4 bytes version+flags, 4 bytes entry_count, then entries).
    if (keys.payloadEnd - keys.payloadStart < 8) continue;
    const keyList = [];
    let kpos = keys.payloadStart + 8;
    while (kpos + 8 <= keys.payloadEnd) {
      const ksize = view.getUint32(kpos);
      if (ksize < 8 || kpos + ksize > keys.payloadEnd) break;
      const keyValue = new TextDecoder('utf-8').decode(buffer.slice(kpos + 8, kpos + ksize));
      keyList.push(keyValue);
      kpos += ksize;
    }

    const locKeyIdx = keyList.findIndex((v) => v.includes('location.ISO6709'));
    if (locKeyIdx < 0) continue;
    const targetIdx = locKeyIdx + 1; // ilst keys are 1-based

    let ipos = ilst.payloadStart;
    while (ipos + 8 <= ilst.payloadEnd) {
      const isize = view.getUint32(ipos);
      if (isize < 8 || ipos + isize > ilst.payloadEnd) break;
      const idx = view.getUint32(ipos + 4);
      if (idx === targetIdx) {
        const data = findMP4Box(view, ipos + 8, ipos + isize, 'data');
        if (data && data.payloadEnd - data.payloadStart >= 8) {
          // data box: 4 bytes type_indicator + 4 bytes locale + value
          const valueStart = data.payloadStart + 8;
          const valueLen = data.payloadEnd - valueStart;
          if (valueLen > 0) {
            const isoStr = new TextDecoder('utf-8').decode(
              buffer.slice(valueStart, valueStart + valueLen),
            );
            const coords = parseISO6709(isoStr);
            if (coords) return coords;
          }
        }
      }
      ipos += isize;
    }
  }
  return null;
}

// Extracts GPS and creation time from an MP4/MOV file (iPhone, Android, GoPro, etc.).
// Returns { coords?: {lat, lng}, takenAt?: ISO string } or null.
async function extractVideoMetadata(file) {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    const moov = findMP4Box(view, 0, buffer.byteLength, 'moov');
    if (!moov) {
      console.warn('[video meta] moov box not found in file');
      return null;
    }
    console.log('[video meta] moov children:', listChildTypes(view, moov));

    const result = {};

    // Try every known location for the GPS string, in order of likelihood.
    let coords = findXyzLocation(view, buffer, moov);
    let source = '';
    if (coords) source = 'moov > ©xyz';

    if (!coords) {
      const udta = findMP4Box(view, moov.payloadStart, moov.payloadEnd, 'udta');
      if (udta) {
        coords = findXyzLocation(view, buffer, udta);
        if (coords) source = 'moov > udta > ©xyz';
        if (!coords) {
          coords = findKeysIlstLocation(view, buffer, udta);
          if (coords) source = 'moov > udta > meta > keys/ilst';
        }
      }
    }
    if (!coords) {
      coords = findKeysIlstLocation(view, buffer, moov);
      if (coords) source = 'moov > meta > keys/ilst';
    }

    if (coords) {
      console.log('[video meta] GPS found via', source, coords);
      result.coords = coords;
    } else {
      console.warn('[video meta] no GPS data found in this video');
    }

    // Creation time via mvhd. Stored as seconds since 1904-01-01 UTC.
    const mvhd = findMP4Box(view, moov.payloadStart, moov.payloadEnd, 'mvhd');
    if (mvhd && mvhd.payloadEnd - mvhd.payloadStart >= 16) {
      const version = view.getUint8(mvhd.payloadStart);
      let creationTime;
      if (version === 1 && mvhd.payloadEnd - mvhd.payloadStart >= 20) {
        const high = view.getUint32(mvhd.payloadStart + 4);
        const low = view.getUint32(mvhd.payloadStart + 8);
        creationTime = high * 4294967296 + low;
      } else {
        creationTime = view.getUint32(mvhd.payloadStart + 4);
      }
      // Convert from 1904-epoch to Unix-epoch (diff = 2,082,844,800 seconds).
      const unixSeconds = creationTime - 2082844800;
      if (unixSeconds > 0) {
        result.takenAt = new Date(unixSeconds * 1000).toISOString();
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (e) {
    console.warn('[video meta] parser error:', e);
    return null;
  }
}

function VideoThumbnail({ src, className }) {
  // Append a media-fragment so the browser seeks to 0.1s and renders a real frame.
  const previewSrc = src ? `${src}#t=0.1` : src;
  return (
    <div className={`relative ${className} overflow-hidden bg-ink-900`}>
      <video
        src={previewSrc}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
        <div className="w-8 h-8 rounded-full bg-gold-500/90 flex items-center justify-center shadow-lg">
          <Play className="w-4 h-4 text-ink-900 ml-0.5" fill="currentColor" />
        </div>
      </div>
    </div>
  );
}

// Cluster marker (for 2+ memories)
function ClusterMarker({ cluster }) {
  const cover = cluster.memories[0];
  const count = cluster.memories.length;
  return (
    <div className="relative cursor-pointer group">
      {/* Stack effect - shadow cards behind */}
      <div className="absolute top-1.5 left-1.5 w-12 h-12 rounded-full border-2 border-gold-500/60 bg-ink-800" />
      <div className="absolute top-0.5 left-0.5 w-12 h-12 rounded-full border-2 border-gold-500/80 bg-ink-800" />
      {/* Main image */}
      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-gold-500 shadow-gold group-hover:scale-110 transition-transform">
        {cover.media_type === 'photo' ? (
          <img src={cover.media_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <VideoThumbnail src={cover.media_url} className="w-full h-full" />
        )}
      </div>
      {/* Counter badge */}
      <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-lacquer-800 border-2 border-gold-500 text-gold-50 text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
        {count}
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gold-500 rotate-45" />
    </div>
  );
}

// Single memory marker
function SingleMarker({ memory }) {
  return (
    <div className="relative group cursor-pointer">
      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gold-500 shadow-gold hover:scale-110 transition-transform">
        {memory.media_type === 'photo' ? (
          <img src={memory.media_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <VideoThumbnail src={memory.media_url} className="w-full h-full" />
        )}
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gold-500 rotate-45" />
    </div>
  );
}

function formatLocationLabel(memory) {
  if (memory.location_name) return memory.location_name;
  const coords = parseCoords(memory.location_coords);
  if (coords) return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  return null;
}

function formatDateTimeLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const datePart = formatDate(d);
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} • ${timePart}`;
}

function PolaroidCard({
  memory,
  currentUserId,
  onUpdated,
  onClose,
  onDelete,
  onEditLocation,
  deleting,
  onDirtyChange,
  onPrev,
  onNext,
  position,
  total,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const editRef = useRef(null);
  const menuRef = useRef(null);

  const isOwner = !!currentUserId && memory.user_id === currentUserId;
  const location = formatLocationLabel(memory);
  const dateTime = formatDateTimeLabel(memory.taken_at || memory.created_at);

  // Tell the parent when there are unsaved edits, so it can ask before closing.
  useEffect(() => {
    const isDirty = editing && draft !== (memory.caption || '');
    onDirtyChange?.(isDirty);
  }, [editing, draft, memory.caption, onDirtyChange]);

  // Reset dirty flag when this card unmounts.
  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  // Close the kebab menu when clicking anywhere outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutsideMenu = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu);
  }, [menuOpen]);

  const startEdit = () => {
    if (!isOwner) return;
    setDraft(memory.caption || '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  const saveEdit = async () => {
    const trimmed = draft.trim();
    const newCaption = trimmed === '' ? null : trimmed;
    if (newCaption === (memory.caption ?? null)) {
      cancelEdit();
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('memories')
      .update({ caption: newCaption })
      .eq('id', memory.id);
    setSaving(false);
    if (error) {
      alert('Failed to save: ' + error.message);
      return;
    }
    onUpdated?.({ ...memory, caption: newCaption });
    setEditing(false);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancelEdit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveEdit();
    }
  };

  // If the user clicks on a non-button passive area while editing, exit edit silently.
  const handleCardClick = (e) => {
    if (!editing) return;
    if (editRef.current?.contains(e.target)) return;
    if (e.target.closest('button')) return;
    cancelEdit();
  };

  const hasPosition = !!(position && total);
  const hasMenu = isOwner && (!!onDelete || !!onEditLocation);
  const showHeader = hasPosition || !!onClose || hasMenu;

  return (
    <div
      className="w-[240px] bg-white p-2.5 pb-4 shadow-xl animate-fade-in"
      onClick={handleCardClick}
    >
      {showHeader && (
        <div className="flex items-center justify-between mb-1.5">
          {hasPosition ? (
            <span className="text-[11px] text-ink-700/60 font-medium">
              {position} of {total}
            </span>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-0.5">
            {hasMenu && (
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="More options"
                  className="p-1 text-ink-700/40 hover:text-ink-900 hover:bg-gray-100 rounded transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-white shadow-lg rounded border border-gray-200 py-1 min-w-[160px] z-10">
                    {onEditLocation && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEditLocation();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink-900 hover:bg-gray-100"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Edit location
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        disabled={deleting}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        {deleting ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1 text-ink-700/40 hover:text-ink-900 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="relative">
        <div className="flex items-center justify-center min-h-[120px] bg-gray-50">
          {memory.media_type === 'photo' ? (
            <img
              src={memory.media_url}
              alt=""
              className="block max-w-full max-h-[160px]"
            />
          ) : (
            <video
              src={`${memory.media_url}#t=0.1`}
              controls
              playsInline
              preload="metadata"
              className="block max-w-full max-h-[180px] bg-black"
            />
          )}
        </div>
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous photo"
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next photo"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="mt-2 px-0.5 space-y-1">
        {location && (
          <div className="flex items-center gap-1 text-ink-800">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="text-[11px] truncate">{location}</span>
          </div>
        )}
        {dateTime && (
          <div className="flex items-center gap-1 text-ink-700/70">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span className="text-[11px]">{dateTime}</span>
          </div>
        )}
        {editing ? (
          <div ref={editRef} className="pt-1">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a note..."
              rows={3}
              className="w-full text-sm font-accent text-ink-900 bg-gray-50 border border-gray-300 rounded p-1.5 resize-none focus:outline-none focus:border-gold-600"
            />
            <div className="flex items-center gap-1.5 mt-1">
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="px-2.5 py-0.5 text-[11px] bg-ink-900 text-white rounded hover:bg-ink-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="px-2.5 py-0.5 text-[11px] text-ink-700 hover:text-ink-900"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : memory.caption ? (
          <div className="flex items-start gap-1 pt-1">
            <p
              onDoubleClick={startEdit}
              className="font-accent text-sm text-ink-900 leading-snug flex-1"
            >
              {memory.caption}
            </p>
            {isOwner && (
              <button
                type="button"
                onClick={startEdit}
                className="p-0.5 text-ink-700/40 hover:text-ink-900 transition-colors"
                aria-label="Edit caption"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : isOwner ? (
          <button
            type="button"
            onClick={startEdit}
            className="text-[11px] text-ink-700/50 italic hover:text-ink-700 pt-1 text-left"
          >
            Add a note...
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MediaStrip({ memories, onSelectMemory, onClose }) {
  const scrollRef = useRef(null);
  const count = memories.length;
  const namesSet = new Set(memories.map((m) => m.location_name).filter(Boolean));
  const sharedName = namesSet.size === 1 ? [...namesSet][0] : null;
  const showArrows = count > 3;

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 160, behavior: 'smooth' });
  };

  return (
    <div className="w-[280px] bg-white shadow-xl animate-fade-in">
      <div className="px-3 py-2 border-b border-gray-200 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {sharedName ? (
            <>
              <p className="text-sm font-medium text-ink-900 truncate">{sharedName}</p>
              <p className="text-[11px] text-ink-700/70 mt-0.5">{count} memories</p>
            </>
          ) : (
            <p className="text-sm font-medium text-ink-900">
              {count} memories at this location
            </p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 -mt-0.5 text-ink-700/40 hover:text-ink-900 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="relative px-2 py-2.5">
        {showArrows && (
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Scroll left"
            className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/95 border border-gray-200 hover:bg-gray-100 text-ink-900 rounded-full flex items-center justify-center shadow-sm z-10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div
          ref={scrollRef}
          className={`overflow-x-auto flex gap-1.5 scroll-smooth scrollbar-hide snap-x snap-mandatory ${showArrows ? 'mx-7' : ''}`}
        >
          {memories.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => onSelectMemory(m.id)}
              className="flex-shrink-0 w-16 h-16 overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity snap-start"
              aria-label="Open memory"
            >
              {m.media_type === 'photo' ? (
                <img src={m.media_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <VideoThumbnail src={m.media_url} className="w-full h-full" />
              )}
            </button>
          ))}
        </div>
        {showArrows && (
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="Scroll right"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/95 border border-gray-200 hover:bg-gray-100 text-ink-900 rounded-full flex items-center justify-center shadow-sm z-10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function LocationPickerToolbar({
  coords,
  locationName,
  countryISO,
  proximity,
  sessionToken,
  onPick,
  onSave,
  onCancel,
  saving,
  modeLabel,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  // After picking from the dropdown we also set the input value to the chosen
  // place name. That would normally re-trigger the search effect — this ref
  // tells the next effect run to skip exactly once.
  const skipNextSearchRef = useRef(false);

  // Abort any pending fetch on unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Run a debounced search whenever the query changes.
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await forwardGeocode(query, {
        signal: ctrl.signal,
        proximity,
        country: countryISO,
        sessionToken,
      });
      if (!ctrl.signal.aborted) {
        setResults(res);
        setSearching(false);
        setShowResults(true);
      }
    }, 300);
  }, [query, proximity, countryISO, sessionToken]);

  const handlePick = (r) => {
    skipNextSearchRef.current = true;
    setQuery(r.placeName);
    setShowResults(false);
    setResults([]);
    setSearching(false);
    onPick(r.coords, r.placeName, 'search');
  };

  const subtitle = locationName
    ? locationName
    : `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;

  return (
    <div className="absolute top-3 left-3 right-3 z-20 max-w-[360px] mx-auto bg-white rounded-lg shadow-xl border border-gray-200 animate-fade-in">
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-900">{modeLabel}</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="p-1 text-ink-700/40 hover:text-ink-900 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-ink-700/60 mt-0.5 truncate">{subtitle}</p>
      </div>
      <div className="px-3 py-2">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Search address or place..."
            className="w-full text-sm text-ink-900 bg-gray-50 border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-gold-600"
          />
          {showResults && (results.length > 0 || searching) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-30 max-h-[200px] overflow-y-auto">
              {searching && results.length === 0 && (
                <p className="text-xs text-ink-700/60 px-2 py-1.5">Searching...</p>
              )}
              {results.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => handlePick(r)}
                  className="w-full text-left px-2 py-1.5 text-xs text-ink-900 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                >
                  {r.placeName}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-[10px] text-ink-700/50 mt-1">or click on the map / drag the pin</p>
        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1 text-xs text-ink-700 hover:text-ink-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1 text-xs bg-ink-900 text-white rounded hover:bg-ink-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MemoriesMapTab({ trip }) {
  const { user } = useAuth();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [zoom, setZoom] = useState(5);
  const [albumMemories, setAlbumMemories] = useState(null); // null | array of memories
  const [lightboxIndex, setLightboxIndex] = useState(null); // null | index in album
  const [selectedCluster, setSelectedCluster] = useState(null); // null | { longitude, latitude, memories }
  // null | { mode, coords, locationName, nameSource, memoryId?, sessionToken }
  const [locationPicker, setLocationPicker] = useState(null);
  const [pickerSaving, setPickerSaving] = useState(false);
  const fileInputRef = useRef(null);
  const mapRef = useRef(null);
  // Tracks whether the open popover has unsaved caption edits.
  const dirtyRef = useRef(false);
  // Debounce timer for reverse-geocoding the picker's coords after click/drag.
  const reverseGeoTimerRef = useRef(null);

  const handleMemoryUpdate = useCallback((updated) => {
    setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setSelectedCluster((prev) =>
      prev
        ? { ...prev, memories: prev.memories.map((m) => (m.id === updated.id ? updated : m)) }
        : prev
    );
  }, []);

  const handleDirtyChange = useCallback((isDirty) => {
    dirtyRef.current = isDirty;
  }, []);

  // Runs an action, but first asks the user if there are unsaved caption edits.
  const guardedAction = useCallback((action) => {
    if (dirtyRef.current) {
      if (!window.confirm('Discard unsaved caption changes?')) return;
    }
    dirtyRef.current = false;
    action();
  }, []);

  const closeWithCheck = useCallback(() => {
    guardedAction(() => setSelectedCluster(null));
  }, [guardedAction]);

  const startEditLocation = useCallback((memory) => {
    guardedAction(() => {
      const coords = parseCoords(memory.location_coords);
      if (!coords) return;
      setSelectedCluster(null);
      setLocationPicker({
        mode: 'edit',
        memoryId: memory.id,
        coords,
        locationName: memory.location_name || null,
        nameSource: memory.location_name ? 'manual' : 'pending-reverse',
        sessionToken: crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      });
      // Fly map to the photo's spot so the pin is in view.
      mapRef.current?.flyTo?.({ center: [coords.lng, coords.lat], zoom: 13, duration: 600 });
    });
  }, [guardedAction]);

  const startUploadLocationPick = useCallback(() => {
    if (!pendingUpload) return;
    setLocationPicker({
      mode: 'upload',
      coords: { ...pendingUpload.coords },
      locationName: pendingUpload.detectedPlace || null,
      nameSource: pendingUpload.detectedPlace ? 'manual' : 'pending-reverse',
      sessionToken: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    });
    mapRef.current?.flyTo?.({
      center: [pendingUpload.coords.lng, pendingUpload.coords.lat],
      zoom: 13,
      duration: 600,
    });
  }, [pendingUpload]);

  const cancelLocationPick = useCallback(() => {
    if (reverseGeoTimerRef.current) {
      clearTimeout(reverseGeoTimerRef.current);
      reverseGeoTimerRef.current = null;
    }
    setLocationPicker(null);
  }, []);

  const updatePickerCoords = useCallback((coords) => {
    setLocationPicker((prev) =>
      prev
        ? {
            ...prev,
            coords,
            // Clicking/dragging invalidates any previous name. We'll refresh it.
            locationName: null,
            nameSource: 'pending-reverse',
          }
        : prev
    );
    // Debounced reverse geocode so the toolbar shows the address.
    if (reverseGeoTimerRef.current) clearTimeout(reverseGeoTimerRef.current);
    reverseGeoTimerRef.current = setTimeout(async () => {
      const geo = await reverseGeocode(coords.lat, coords.lng);
      setLocationPicker((prev) => {
        if (!prev) return prev;
        // Stale check: ignore if user moved to different coords meanwhile.
        if (prev.coords.lat !== coords.lat || prev.coords.lng !== coords.lng) return prev;
        // Don't override if the user picked from search since.
        if (prev.nameSource === 'search') return prev;
        return {
          ...prev,
          locationName: geo?.placeName || null,
          nameSource: 'reverse',
        };
      });
    }, 500);
  }, []);

  const handlePickerPick = useCallback((coords, placeName, nameSource) => {
    setLocationPicker((prev) =>
      prev ? { ...prev, coords, locationName: placeName, nameSource } : prev
    );
  }, []);

  const saveLocationPick = useCallback(async () => {
    const picker = locationPicker;
    if (!picker) return;
    if (reverseGeoTimerRef.current) {
      clearTimeout(reverseGeoTimerRef.current);
      reverseGeoTimerRef.current = null;
    }
    setPickerSaving(true);
    try {
      // If user didn't pick from search, refresh place name via reverse geocoding.
      let finalName = picker.locationName;
      let geo = null;
      if (picker.nameSource !== 'search') {
        geo = await reverseGeocode(picker.coords.lat, picker.coords.lng);
        if (geo?.placeName) finalName = geo.placeName;
      }

      if (picker.mode === 'edit') {
        const wkt = `POINT(${picker.coords.lng} ${picker.coords.lat})`;
        const { data: updatedRow, error } = await supabase
          .from('memories')
          .update({ location_coords: wkt, location_name: finalName || null })
          .eq('id', picker.memoryId)
          .select()
          .single();
        if (error) {
          alert('Could not save location: ' + error.message);
          setPickerSaving(false);
          return;
        }
        // Optimistic merge: keep coords as plain {lat,lng} for the in-memory shape.
        const updated = {
          ...updatedRow,
          coords: picker.coords,
        };
        handleMemoryUpdate(updated);
        // Re-open the popover anchored at the new spot, focused on this memory.
        setSelectedCluster({
          longitude: picker.coords.lng,
          latitude: picker.coords.lat,
          memories: [updated],
          focusedMemoryId: updated.id,
        });
        mapRef.current?.flyTo?.({
          center: [picker.coords.lng, picker.coords.lat],
          zoom: 13,
          duration: 600,
        });
      } else {
        // upload mode: merge into pendingUpload, recompute country mismatch
        const detectedCountry = geo?.country || null;
        const matchesTripCountry =
          detectedCountry &&
          (detectedCountry.toLowerCase() === tripCountry.toLowerCase() ||
            normalizeCountryName(detectedCountry).toLowerCase() === tripCountry.toLowerCase());
        setPendingUpload((prev) =>
          prev
            ? {
                ...prev,
                coords: picker.coords,
                detectedCountry,
                detectedPlace: finalName || null,
                matchesTripCountry: !!matchesTripCountry,
                coordsSource: 'manual',
              }
            : prev
        );
      }
      setLocationPicker(null);
    } finally {
      setPickerSaving(false);
    }
  }, [locationPicker, handleMemoryUpdate]);

  // Close the popover when the user presses Escape (with dirty-check).
  useEffect(() => {
    if (!selectedCluster) return;
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;
      // If a textarea has focus, the edit handler in PolaroidCard handles Escape itself.
      if (document.activeElement?.tagName === 'TEXTAREA') return;
      closeWithCheck();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedCluster, closeWithCheck]);

  // Escape closes the location picker too.
  useEffect(() => {
    if (!locationPicker) return;
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return;
      // Skip when an input/textarea has focus (the user is typing a search query).
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      cancelLocationPick();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [locationPicker, cancelLocationPick]);

  // If the memory being edited disappears (e.g. deleted by realtime), cancel the picker.
  useEffect(() => {
    if (!locationPicker || locationPicker.mode !== 'edit') return;
    const exists = memories.some((m) => m.id === locationPicker.memoryId);
    if (!exists) setLocationPicker(null);
  }, [memories, locationPicker]);

  const tripCountry = normalizeCountryName(trip.country);
  const center = COUNTRY_CENTERS[tripCountry] || { lat: 21.0285, lng: 105.8542, zoom: 5 };

  useEffect(() => {
    loadMemories();
    const channel = supabase
      .channel(`memories-${trip.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'memories', filter: `trip_id=eq.${trip.id}` },
        () => loadMemories()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [trip.id]);

  async function loadMemories() {
    try {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('trip_id', trip.id)
        .order('taken_at', { ascending: false });
      if (error) throw error;
      const parsed = (data || []).map((m) => ({ ...m, coords: parseCoords(m.location_coords) }));
      const valid = parsed.filter((m) => m.coords && !isNaN(m.coords.lat) && !isNaN(m.coords.lng));
      setMemories(valid);
    } catch (err) {
      console.error('Error loading memories:', err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteMemory(memory) {
    if (!confirm('Delete this memory? This cannot be undone.')) return;
    setDeletingId(memory.id);
    try {
      // Optimistic update
      setMemories((prev) => prev.filter((m) => m.id !== memory.id));
      // Update album if open
      if (albumMemories) {
        const newAlbum = albumMemories.filter((m) => m.id !== memory.id);
        if (newAlbum.length === 0) {
          setAlbumMemories(null);
          setLightboxIndex(null);
        } else {
          setAlbumMemories(newAlbum);
          if (lightboxIndex !== null && lightboxIndex >= newAlbum.length) {
            setLightboxIndex(newAlbum.length - 1);
          }
        }
      }
      // Update map popover if open
      setSelectedCluster((prev) => {
        if (!prev) return prev;
        const newMems = prev.memories.filter((m) => m.id !== memory.id);
        if (newMems.length === 0) return null;
        const newFocused = prev.focusedMemoryId === memory.id ? null : prev.focusedMemoryId;
        return { ...prev, memories: newMems, focusedMemoryId: newFocused };
      });

      if (memory.media_url) {
        const urlParts = memory.media_url.split('/memories/');
        if (urlParts.length === 2) {
          await supabase.storage.from('memories').remove([urlParts[1]]);
        }
      }
      const { error } = await supabase.from('memories').delete().eq('id', memory.id);
      if (error) {
        loadMemories();
        throw error;
      }
    } catch (err) {
      alert('Could not delete: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  }

  // Cluster memories based on current zoom
  const clusters = useMemo(() => clusterMemories(memories, zoom), [memories, zoom]);

  // Calculate initial map view that fits all memories
  const initialView = useMemo(() => {
    if (memories.length === 0) {
      return { longitude: center.lng, latitude: center.lat, zoom: center.zoom };
    }
    if (memories.length === 1) {
      return { longitude: memories[0].coords.lng, latitude: memories[0].coords.lat, zoom: 13 };
    }
    const bounds = calculateBounds(memories);
    const latDiff = bounds.maxLat - bounds.minLat;
    const lngDiff = bounds.maxLng - bounds.minLng;
    const maxDiff = Math.max(latDiff, lngDiff);
    // Estimate appropriate zoom
    let z = 13;
    if (maxDiff > 0.001) z = 13;
    if (maxDiff > 0.01) z = 11;
    if (maxDiff > 0.1) z = 9;
    if (maxDiff > 1) z = 6;
    if (maxDiff > 10) z = 4;
    if (maxDiff > 50) z = 2;
    return {
      longitude: (bounds.minLng + bounds.maxLng) / 2,
      latitude: (bounds.minLat + bounds.maxLat) / 2,
      zoom: z,
    };
  }, [memories.length]); // intentionally only re-fit when count changes

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const isVideo = file.type.startsWith('video/');
      let coords = null;
      let takenAt = null;
      let coordsSource = 'default';

      if (!isVideo) {
        const exif = await exifr.parse(file, { gps: true }).catch(() => null);
        if (exif?.latitude && exif?.longitude) {
          coords = { lat: exif.latitude, lng: exif.longitude };
          coordsSource = 'exif';
        }
        if (exif?.DateTimeOriginal) {
          takenAt = new Date(exif.DateTimeOriginal).toISOString();
        }
      } else {
        const meta = await extractVideoMetadata(file);
        if (meta?.coords) {
          coords = meta.coords;
          coordsSource = 'video-meta';
        }
        if (meta?.takenAt) {
          takenAt = meta.takenAt;
        }
      }

      if (!coords) {
        const browserCoords = await getCurrentLocation();
        if (browserCoords) {
          coords = browserCoords;
          coordsSource = 'browser';
        }
      }

      if (!coords) {
        coords = { lat: center.lat, lng: center.lng };
        coordsSource = 'default';
      }

      if (!takenAt && file.lastModified) {
        takenAt = new Date(file.lastModified).toISOString();
      }

      const geo = await reverseGeocode(coords.lat, coords.lng);
      const detectedCountry = geo?.country;
      const matchesTripCountry = detectedCountry &&
        (detectedCountry.toLowerCase() === tripCountry.toLowerCase() ||
         normalizeCountryName(detectedCountry).toLowerCase() === tripCountry.toLowerCase());

      const reader = new FileReader();
      reader.onload = () => {
        setPendingUpload({
          file, preview: reader.result, isVideo, coords, coordsSource,
          detectedCountry, detectedPlace: geo?.placeName, matchesTripCountry,
          takenAt: takenAt || new Date().toISOString(),
        });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert('Error reading the file');
      setUploading(false);
    }
    e.target.value = '';
  }

  async function uploadMemory(data) {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = data.file.name.split('.').pop();
      const fileName = `${trip.id}/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('memories')
        .upload(fileName, data.file, { cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('memories').getPublicUrl(fileName);
      const { data: inserted, error: insertError } = await supabase.from('memories').insert({
        trip_id: trip.id,
        user_id: user.id,
        media_url: publicUrl,
        media_type: data.isVideo ? 'video' : 'photo',
        caption: data.caption || null,
        location_coords: `POINT(${data.coords.lng} ${data.coords.lat})`,
        location_name: data.locationName || data.detectedPlace || null,
        taken_at: data.takenAt,
      }).select().single();
      if (insertError) throw insertError;
      setPendingUpload(null);
      if (inserted) {
        const withCoords = { ...inserted, coords: parseCoords(inserted.location_coords) };
        setMemories((prev) => [withCoords, ...prev]);
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Upload error');
    } finally {
      setUploading(false);
    }
  }

  async function useCurrentLocation() {
    const browserCoords = await getCurrentLocation();
    if (browserCoords) {
      const geo = await reverseGeocode(browserCoords.lat, browserCoords.lng);
      const matchesTripCountry = geo?.country &&
        (geo.country.toLowerCase() === tripCountry.toLowerCase() ||
         normalizeCountryName(geo.country).toLowerCase() === tripCountry.toLowerCase());
      setPendingUpload((prev) => ({
        ...prev,
        coords: browserCoords,
        coordsSource: 'browser',
        detectedCountry: geo?.country,
        detectedPlace: geo?.placeName,
        matchesTripCountry,
      }));
      return true;
    }
    alert('Could not get your location. Make sure location permissions are enabled.');
    return false;
  }

  async function useTripCountryCenter() {
    const newCoords = { lat: center.lat, lng: center.lng };
    const geo = await reverseGeocode(newCoords.lat, newCoords.lng);
    setPendingUpload((prev) => ({
      ...prev,
      coords: newCoords,
      coordsSource: 'default',
      detectedCountry: geo?.country,
      detectedPlace: geo?.placeName,
      matchesTripCountry: true,
    }));
  }

  // Click handler for marker - opens popover anchored at the cluster location
  const handleMarkerClick = useCallback((cluster, e) => {
    e.originalEvent.stopPropagation();
    setSelectedCluster({
      longitude: cluster.coords.lng,
      latitude: cluster.coords.lat,
      memories: cluster.memories,
      focusedMemoryId: null,
    });
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="card-warm text-center py-8">
        <MapPin className="w-12 h-12 text-gold-500/40 mx-auto mb-3" />
        <p className="text-ivory-100/70">Mapbox token is required to view the map</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="relative rounded-2xl overflow-hidden border border-lacquer-900/40 ornamental-border h-[500px]">
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={initialView}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          onMove={(evt) => setZoom(evt.viewState.zoom)}
          onClick={(evt) => {
            if (locationPicker) {
              updatePickerCoords({ lat: evt.lngLat.lat, lng: evt.lngLat.lng });
              return;
            }
            if (selectedCluster) closeWithCheck();
          }}
        >
          {!locationPicker && clusters.map((cluster, idx) => (
            <Marker
              key={`cluster-${idx}-${cluster.memories.map((m) => m.id).join('-')}`}
              longitude={cluster.coords.lng}
              latitude={cluster.coords.lat}
              anchor="bottom"
              onClick={(e) => handleMarkerClick(cluster, e)}
            >
              {cluster.memories.length === 1 ? (
                <SingleMarker memory={cluster.memories[0]} />
              ) : (
                <ClusterMarker cluster={cluster} />
              )}
            </Marker>
          ))}

          {locationPicker && (
            <Marker
              longitude={locationPicker.coords.lng}
              latitude={locationPicker.coords.lat}
              anchor="bottom"
              draggable
              onDragEnd={(e) =>
                updatePickerCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
              }
            >
              <div className="relative cursor-grab active:cursor-grabbing">
                <div className="w-10 h-10 rounded-full border-4 border-gold-500 bg-lacquer-700 shadow-gold flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-gold-50" fill="currentColor" />
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gold-500 rotate-45" />
              </div>
            </Marker>
          )}

          {!locationPicker && selectedCluster && (() => {
            const cluster = selectedCluster;
            const memories = cluster.memories;
            const isCluster = memories.length > 1;
            const focusedIdx = cluster.focusedMemoryId
              ? memories.findIndex((m) => m.id === cluster.focusedMemoryId)
              : -1;
            const focusedMemory = focusedIdx >= 0 ? memories[focusedIdx] : null;
            const showSingle = !isCluster || focusedMemory;
            const singleMemory = !isCluster ? memories[0] : focusedMemory;

            const goToFocus = (id) =>
              setSelectedCluster((prev) =>
                prev ? { ...prev, focusedMemoryId: id } : prev
              );
            // X in focused-from-cluster goes back to the strip; in single-direct it closes.
            const handleSingleClose = isCluster
              ? () => guardedAction(() => goToFocus(null))
              : closeWithCheck;
            const handlePrev =
              isCluster && focusedIdx > 0
                ? () => guardedAction(() => goToFocus(memories[focusedIdx - 1].id))
                : undefined;
            const handleNext =
              isCluster && focusedIdx < memories.length - 1
                ? () => guardedAction(() => goToFocus(memories[focusedIdx + 1].id))
                : undefined;

            return (
              <Popup
                longitude={cluster.longitude}
                latitude={cluster.latitude}
                anchor="bottom"
                closeOnClick={false}
                closeButton={false}
                onClose={() => setSelectedCluster(null)}
                maxWidth="none"
                className="memory-popup"
              >
                {showSingle ? (
                  <PolaroidCard
                    memory={singleMemory}
                    currentUserId={user?.id}
                    onUpdated={handleMemoryUpdate}
                    onClose={handleSingleClose}
                    onDelete={() => deleteMemory(singleMemory)}
                    onEditLocation={
                      singleMemory.user_id === user?.id
                        ? () => startEditLocation(singleMemory)
                        : undefined
                    }
                    deleting={deletingId === singleMemory.id}
                    onDirtyChange={handleDirtyChange}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    position={isCluster && focusedMemory ? focusedIdx + 1 : undefined}
                    total={isCluster ? memories.length : undefined}
                  />
                ) : (
                  <MediaStrip
                    memories={memories}
                    onClose={closeWithCheck}
                    onSelectMemory={goToFocus}
                  />
                )}
              </Popup>
            );
          })()}
        </Map>

        {locationPicker && (
          <LocationPickerToolbar
            coords={locationPicker.coords}
            locationName={locationPicker.locationName}
            countryISO={tripCountryISO(tripCountry)}
            proximity={locationPicker.coords}
            sessionToken={locationPicker.sessionToken}
            modeLabel={locationPicker.mode === 'edit' ? 'Edit location' : 'Pick location'}
            saving={pickerSaving}
            onPick={handlePickerPick}
            onSave={saveLocationPick}
            onCancel={cancelLocationPick}
          />
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !!locationPicker}
          className="absolute bottom-4 right-4 z-10 btn-gold flex items-center gap-2 shadow-2xl"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span>Add Photo</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <p className="text-ivory-100/60">
          <span className="text-gold-500 font-bold">{memories.length}</span>{' '}
          {memories.length === 1 ? 'memory' : 'memories'} on the map
        </p>
      </div>

      {memories.length > 0 && (
        <section className="mt-8">
          <h3 className="font-display text-lg font-semibold mb-4 text-gold-500">Recent</h3>
          <div className="grid grid-cols-3 gap-2">
            {memories.slice(0, 9).map((m, idx) => (
              <div key={m.id} className="relative group">
                <button
                  onClick={() => {
                    setAlbumMemories(memories);
                    setLightboxIndex(memories.findIndex((x) => x.id === m.id));
                  }}
                  className="w-full aspect-square rounded-xl overflow-hidden border border-lacquer-900/40 hover:border-gold-500/40 transition-all"
                >
                  {m.media_type === 'photo' ? (
                    <img src={m.media_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <VideoThumbnail src={m.media_url} className="w-full h-full" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMemory(m);
                  }}
                  disabled={deletingId === m.id}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-600/90 hover:bg-red-700 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg disabled:opacity-50"
                  title="Delete memory"
                >
                  {deletingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Album modal - grid view */}
      {albumMemories && lightboxIndex === null && (
        <AlbumModal
          memories={albumMemories}
          onClose={() => setAlbumMemories(null)}
          onSelectMemory={(idx) => setLightboxIndex(idx)}
          onDelete={deleteMemory}
          deletingId={deletingId}
        />
      )}

      {/* Lightbox - full-screen single memory with navigation */}
      {albumMemories && lightboxIndex !== null && (
        <Lightbox
          memories={albumMemories}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onDelete={deleteMemory}
          deletingId={deletingId}
        />
      )}

      {pendingUpload && (
        <UploadModal
          data={pendingUpload}
          tripCountry={tripCountry}
          onClose={() => setPendingUpload(null)}
          onSave={uploadMemory}
          onUseCurrentLocation={useCurrentLocation}
          onUseTripCountryCenter={useTripCountryCenter}
          onPickOnMap={startUploadLocationPick}
          hidden={!!locationPicker && locationPicker.mode === 'upload'}
          uploading={uploading}
        />
      )}
    </div>
  );
}

// ─── ALBUM MODAL ───────────────────────────────────────────────
function AlbumModal({ memories, onClose, onSelectMemory, onDelete, deletingId }) {
  const placeName = memories.find((m) => m.location_name)?.location_name || `${memories.length} memories`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink-900/90 backdrop-blur-md animate-fade-in">
      <div className="card-warm ornamental-border w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl animate-slide-up">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-ink-800/95 backdrop-blur-md border-b border-gold-500/20 -m-5 mb-4 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-lg font-bold text-ivory-50 truncate">{placeName}</h3>
              <p className="text-xs text-gold-500/70 mt-0.5">
                {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
              </p>
            </div>
            <button onClick={onClose} className="btn-ghost p-2 shrink-0" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {memories.map((m, idx) => (
            <div key={m.id} className="relative group">
              <button
                onClick={() => onSelectMemory(idx)}
                className="w-full aspect-square rounded-xl overflow-hidden border border-lacquer-900/40 hover:border-gold-500/60 transition-all"
              >
                {m.media_type === 'photo' ? (
                  <img src={m.media_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <VideoThumbnail src={m.media_url} className="w-full h-full" />
                )}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(m);
                }}
                disabled={deletingId === m.id}
                className="absolute top-2 right-2 w-7 h-7 bg-red-600/90 hover:bg-red-700 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-lg disabled:opacity-50"
                title="Delete"
              >
                {deletingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── LIGHTBOX ──────────────────────────────────────────────────
function Lightbox({ memories, startIndex, onClose, onIndexChange, onDelete, deletingId }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    onIndexChange(currentIndex);
  }, [currentIndex, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex]);

  const current = memories[currentIndex];
  if (!current) return null;

  function goPrev() {
    setCurrentIndex((i) => (i > 0 ? i - 1 : memories.length - 1));
  }

  function goNext() {
    setCurrentIndex((i) => (i < memories.length - 1 ? i + 1 : 0));
  }

  // Touch gestures for swipe
  const touchStartX = useRef(null);
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-fade-in"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between p-4 text-white safe-area-inset-top"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="btn-ghost p-2 text-white" aria-label="Back to album">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="text-sm font-medium">
          {currentIndex + 1} / {memories.length}
        </div>
        <button
          onClick={() => onDelete(current)}
          disabled={deletingId === current.id}
          className="btn-ghost p-2 text-red-400 hover:text-red-300"
          aria-label="Delete"
        >
          {deletingId === current.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Media area */}
      <div
        className="flex-1 flex items-center justify-center px-2 sm:px-4 relative"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Prev button (desktop) */}
        {memories.length > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-2 sm:left-4 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {current.media_type === 'photo' ? (
          <img
            src={current.media_url}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <video
            src={current.media_url}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Next button (desktop) */}
        {memories.length > 1 && (
          <button
            onClick={goNext}
            className="absolute right-2 sm:right-4 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div
        className="p-4 text-white text-center safe-area-inset-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {current.location_name && (
          <p className="text-sm font-medium text-gold-500">{current.location_name}</p>
        )}
        {current.caption && (
          <p className="text-sm text-white/80 mt-1">{current.caption}</p>
        )}
        <p className="text-xs text-white/50 mt-1 italic">{formatDate(current.taken_at)}</p>
      </div>
    </div>
  );
}

// ─── UPLOAD MODAL ──────────────────────────────────────────────
function UploadModal({ data, tripCountry, onClose, onSave, onUseCurrentLocation, onUseTripCountryCenter, onPickOnMap, hidden, uploading }) {
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState(data.detectedPlace || '');
  const [coords, setCoords] = useState(data.coords);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [confirmedMismatch, setConfirmedMismatch] = useState(false);

  useEffect(() => {
    setCoords(data.coords);
    setLocationName(data.detectedPlace || '');
    setConfirmedMismatch(false);
  }, [data.coords, data.detectedPlace]);

  async function handleUseCurrentLocation() {
    setGettingLocation(true);
    await onUseCurrentLocation();
    setGettingLocation(false);
  }

  const showMismatchWarning = data.detectedCountry && !data.matchesTripCountry && !confirmedMismatch;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in"
      style={hidden ? { display: 'none' } : undefined}
    >
      <div className="card-warm ornamental-border w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold">
            New {data.isVideo ? 'Video' : 'Memory'}
          </h3>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {data.isVideo ? (
          <video src={data.preview} controls className="w-full h-48 object-cover rounded-xl mb-4 bg-black" />
        ) : (
          <img src={data.preview} alt="" className="w-full h-48 object-cover rounded-xl mb-4" />
        )}

        <div className="space-y-3">
          {showMismatchWarning ? (
            <div className="p-4 bg-orange-500/10 border-2 border-orange-500/40 rounded-xl space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-200">
                    Location is in {data.detectedCountry}, not {tripCountry}
                  </p>
                  <p className="text-xs text-orange-200/80 mt-1">
                    {data.detectedPlace || 'Unknown place'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmedMismatch(true)}
                  className="w-full py-2 px-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 rounded-lg text-xs text-orange-100 flex items-center justify-center gap-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Yes, this location is correct</span>
                </button>
                <button
                  type="button"
                  onClick={onUseTripCountryCenter}
                  className="w-full py-2 px-3 bg-gold-500/20 hover:bg-gold-500/30 border border-gold-500/40 rounded-lg text-xs text-gold-100 flex items-center justify-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Use {tripCountry} center instead</span>
                </button>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={gettingLocation}
                  className="w-full py-2 px-3 bg-jade-500/20 hover:bg-jade-500/30 border border-jade-500/40 rounded-lg text-xs text-jade-100 flex items-center justify-center gap-2"
                >
                  {gettingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                  <span>{gettingLocation ? 'Getting location...' : 'Use my current location'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-jade-700/20 border border-jade-500/40 rounded-lg text-xs text-jade-50 flex items-start gap-2">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{data.detectedPlace || 'Location set'}</p>
                {data.detectedCountry && (
                  <p className="text-jade-50/80 mt-0.5">{data.detectedCountry}</p>
                )}
              </div>
            </div>
          )}

          {onPickOnMap && (
            <button
              type="button"
              onClick={onPickOnMap}
              className="w-full py-2 px-3 bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/40 rounded-lg text-xs text-gold-100 flex items-center justify-center gap-2"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Pick exact location on map</span>
            </button>
          )}

          <div>
            <label className="block text-sm font-medium text-ivory-100/80 mb-2">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              className="input-field resize-none"
              placeholder="What was this place about?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ivory-100/80 mb-2">Place Name (Optional)</label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="input-field"
              placeholder="e.g., Old Quarter, Hanoi"
            />
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-ivory-100/60 hover:text-ivory-100/80">
              Advanced: Manual coordinates
            </summary>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="block text-xs text-ivory-100/60 mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={coords.lat}
                  onChange={(e) => setCoords({ ...coords, lat: parseFloat(e.target.value) })}
                  className="input-field text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-ivory-100/60 mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={coords.lng}
                  onChange={(e) => setCoords({ ...coords, lng: parseFloat(e.target.value) })}
                  className="input-field text-xs font-mono"
                />
              </div>
            </div>
          </details>
        </div>

        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => onSave({ ...data, caption, locationName, coords })}
            disabled={uploading || showMismatchWarning}
            className="btn-primary flex-1"
            title={showMismatchWarning ? 'Please confirm or change the location first' : ''}
          >
            {uploading ? 'Uploading...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}