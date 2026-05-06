import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Map, { Marker, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import exifr from 'exifr';
import {
  Upload, MapPin, Loader2, X, Play, Navigation, Trash2,
  AlertTriangle, Check, ChevronLeft, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';

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

function VideoThumbnail({ src, className }) {
  const videoRef = useRef(null);
  return (
    <div className={`relative ${className} overflow-hidden bg-ink-900`}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => {
          if (videoRef.current) videoRef.current.currentTime = 0.1;
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
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

export default function MemoriesMapTab({ trip }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [zoom, setZoom] = useState(5);
  const [albumMemories, setAlbumMemories] = useState(null); // null | array of memories
  const [lightboxIndex, setLightboxIndex] = useState(null); // null | index in album
  const fileInputRef = useRef(null);
  const mapRef = useRef(null);

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

  // Click handler for marker - opens album with all memories at that location
  const handleMarkerClick = useCallback((cluster, e) => {
    e.originalEvent.stopPropagation();
    setAlbumMemories(cluster.memories);
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
        >
          {clusters.map((cluster, idx) => (
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
        </Map>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
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
function UploadModal({ data, tripCountry, onClose, onSave, onUseCurrentLocation, onUseTripCountryCenter, uploading }) {
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in">
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