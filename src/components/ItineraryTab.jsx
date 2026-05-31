import { useEffect, useState } from 'react';
import { Plus, MapPin, X, Trash2, ChevronDown, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatTime, ACTIVITY_TYPES, cn } from '../lib/utils';
import LocationSearchInput from './LocationSearchInput';

// Parse a PostGIS POINT into {lat, lng} for display. The DB column is
// geography(point,4326); supabase-js returns it as either GeoJSON or a
// hex/EWKB string. We accept the most common shapes defensively.
function parseCoords(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') {
    if (Array.isArray(raw.coordinates)) {
      const [lng, lat] = raw.coordinates;
      return { lat, lng };
    }
  }
  if (typeof raw === 'string') {
    const m = raw.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (m) return { lng: parseFloat(m[1]), lat: parseFloat(m[2]) };
  }
  return null;
}

export default function ItineraryTab({ trip }) {
  const [days, setDays] = useState([]);
  const [activities, setActivities] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);
  const [showAddActivity, setShowAddActivity] = useState(null);
  // detailActivity: shows the read-only detail view modal (click on a row)
  // editActivity: shows the edit modal (click "Edit" inside the detail view)
  const [detailActivity, setDetailActivity] = useState(null);
  const [editActivity, setEditActivity] = useState(null);

  useEffect(() => {
    loadDays();

    const channel = supabase
      .channel(`trip-${trip.id}-activities`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `trip_id=eq.${trip.id}` },
        () => loadActivities()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [trip.id]);

  async function loadDays() {
    try {
      const { data, error } = await supabase
        .from('itinerary_days')
        .select('*')
        .eq('trip_id', trip.id)
        .order('day_number');

      if (error) throw error;
      const dayList = data || [];
      setDays(dayList);
      const acts = await loadActivities();

      // Auto-expand the first day only if this looks like a brand-new trip
      // (no custom day titles AND no activities yet). On any trip that has
      // already been edited, all days start closed.
      const hasAnyTitle = dayList.some((d) => d.title);
      const hasAnyActivity = acts.length > 0;
      if (!hasAnyTitle && !hasAnyActivity && dayList[0]) {
        setExpandedDay(dayList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadActivities() {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('trip_id', trip.id)
      .order('start_time', { nullsFirst: false });

    if (error) {
      console.error(error);
      return [];
    }

    const grouped = {};
    data.forEach((act) => {
      if (!grouped[act.day_id]) grouped[act.day_id] = [];
      grouped[act.day_id].push(act);
    });
    setActivities(grouped);
    return data;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 shimmer rounded-2xl" />
        ))}
      </div>
    );
  }

  function handleDayUpdate(updated) {
    setDays((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  function handleActivityAdded(activity) {
    setActivities((prev) => {
      const existing = prev[activity.day_id] || [];
      if (existing.some((a) => a.id === activity.id)) return prev;
      return { ...prev, [activity.day_id]: [...existing, activity] };
    });
  }

  function handleActivityDeleted(activityId, dayId) {
    setActivities((prev) => {
      const existing = prev[dayId] || [];
      return { ...prev, [dayId]: existing.filter((a) => a.id !== activityId) };
    });
    setDetailActivity((prev) => (prev?.id === activityId ? null : prev));
  }

  function handleActivityUpdated(updated) {
    setActivities((prev) => {
      const existing = prev[updated.day_id] || [];
      return {
        ...prev,
        [updated.day_id]: existing.map((a) => (a.id === updated.id ? updated : a)),
      };
    });
    setDetailActivity((prev) => (prev?.id === updated.id ? updated : prev));
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {days.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          activities={activities[day.id] || []}
          isExpanded={expandedDay === day.id}
          onToggle={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
          onAddActivity={() => setShowAddActivity(day.id)}
          onDayUpdate={handleDayUpdate}
          onActivityClick={setDetailActivity}
        />
      ))}

      {showAddActivity && (
        <ActivityModal
          mode="create"
          dayId={showAddActivity}
          tripId={trip.id}
          tripCountry={trip.country}
          onClose={() => setShowAddActivity(null)}
          onAdded={handleActivityAdded}
        />
      )}

      {editActivity && (
        <ActivityModal
          mode="edit"
          dayId={editActivity.day_id}
          tripId={trip.id}
          tripCountry={trip.country}
          activity={editActivity}
          onClose={() => setEditActivity(null)}
          onUpdated={(updated) => {
            handleActivityUpdated(updated);
            setEditActivity(null);
          }}
        />
      )}

      {detailActivity && (
        <ActivityDetailModal
          activity={detailActivity}
          onClose={() => setDetailActivity(null)}
          onEdit={() => {
            setEditActivity(detailActivity);
            setDetailActivity(null);
          }}
          onDeleted={(id, dayId) => {
            handleActivityDeleted(id, dayId);
            setDetailActivity(null);
          }}
        />
      )}
    </div>
  );
}

function DayCard({ day, activities, isExpanded, onToggle, onAddActivity, onDayUpdate, onActivityClick }) {
  const dayDate = new Date(day.date);
  const isToday = dayDate.toDateString() === new Date().toDateString();
  const isPast = dayDate < new Date() && !isToday;
  const monthShort = dayDate.toLocaleString('en-US', { month: 'short' });
  const dayNum = dayDate.getDate();
  const weekday = dayDate.toLocaleString('en-US', { weekday: 'long' });
  const defaultTitle = `Day ${day.day_number} · ${weekday}`;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = (e) => {
    e.stopPropagation();
    setDraft(day.title || '');
    setEditing(true);
  };

  const cancelEdit = (e) => {
    e?.stopPropagation();
    setEditing(false);
    setDraft('');
  };

  const saveEdit = async (e) => {
    e?.stopPropagation();
    const trimmed = draft.trim();
    const newTitle = trimmed === '' ? null : trimmed;
    if (newTitle === (day.title ?? null)) {
      cancelEdit();
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('itinerary_days')
      .update({ title: newTitle })
      .eq('id', day.id);
    setSaving(false);
    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    onDayUpdate?.({ ...day, title: newTitle });
    setEditing(false);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    // Stop bubbling so the parent role="button" Space/Enter handler doesn't
    // intercept normal typing — that was eating space characters in the title.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(e);
    } else if (e.key === 'Escape') {
      cancelEdit(e);
    }
  };

  const handleHeaderClick = () => {
    if (editing) return;
    onToggle();
  };

  return (
    <div className={cn(
      'card-warm transition-all duration-300',
      isToday && 'ring-2 ring-coral-500/40',
      isPast && 'opacity-70'
    )}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleHeaderClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleHeaderClick();
          }
        }}
        className="w-full flex items-center justify-between text-left cursor-pointer"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-display flex-shrink-0',
            isToday
              ? 'bg-gradient-coral text-white shadow-coral'
              : 'bg-coral-100 text-coral-700 border border-coral-200'
          )}>
            <span className="text-[10px] leading-none uppercase tracking-wide">
              {monthShort}
            </span>
            <span className="text-xl font-bold leading-none mt-0.5">{dayNum}</span>
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={defaultTitle}
                  autoFocus
                  className="flex-1 min-w-0 font-display text-base font-semibold text-ink-900 bg-surface-100 border border-coral-300 rounded px-2 py-1 focus:outline-none focus:border-coral-500"
                />
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-2.5 py-1 text-xs bg-coral-500 hover:bg-coral-600 text-white rounded disabled:opacity-50 flex-shrink-0"
                >
                  {saving ? '...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="px-2 py-1 text-xs text-sage-600 hover:text-ink-900 flex-shrink-0"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-1">
                <p className="font-display text-lg font-semibold text-ink-900 flex-1 min-w-0 truncate">
                  {day.title || defaultTitle}
                </p>
                <button
                  type="button"
                  onClick={startEdit}
                  className="p-1 text-sage-500 hover:text-ink-900 hover:bg-surface-200 rounded transition-colors flex-shrink-0"
                  aria-label="Edit day title"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-xs text-sage-600 mt-0.5">
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
              {isToday && <span className="text-coral-600 ml-2">· Today</span>}
            </p>
          </div>
        </div>
        {!editing && (
          <ChevronDown className={cn(
            'w-5 h-5 text-sage-500 transition-transform flex-shrink-0',
            isExpanded && 'rotate-180'
          )} />
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-surface-200 animate-fade-in">
          {activities.length === 0 ? (
            <p className="text-sm text-sage-400 text-center py-4">
              No activities yet for this day
            </p>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  onClick={() => onActivityClick?.(activity)}
                />
              ))}
            </div>
          )}
          <button
            onClick={onAddActivity}
            className="mt-3 w-full py-2.5 border border-dashed border-coral-500/30 rounded-xl text-coral-500/80 hover:border-coral-500/60 hover:bg-coral-500/5 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Activity</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityRow({ activity, onClick }) {
  const type = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.other;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex gap-3 p-3 bg-surface-100 rounded-xl border border-surface-200 hover:border-coral-500/40 hover:bg-surface-200 transition-all"
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0', type.color)}>
        {type.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-ink-900 truncate">{activity.title}</h4>
          {activity.start_time && (
            <span className="text-xs text-coral-600 font-mono whitespace-nowrap shrink-0">
              {formatTime(activity.start_time)}
            </span>
          )}
        </div>
        {activity.location_name && (
          <p className="text-xs text-sage-600 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{activity.location_name}</span>
          </p>
        )}
        {activity.notes && (
          <p className="text-xs text-sage-500 mt-1 line-clamp-1">{activity.notes}</p>
        )}
      </div>
    </button>
  );
}

function ActivityDetailModal({ activity, onClose, onEdit, onDeleted }) {
  const type = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.other;
  const [deleting, setDeleting] = useState(false);
  const coords = parseCoords(activity.location_coords);

  async function handleDelete() {
    if (!confirm('Delete this activity?')) return;
    setDeleting(true);
    const { error } = await supabase.from('activities').delete().eq('id', activity.id);
    setDeleting(false);
    if (error) {
      alert('Could not delete: ' + error.message);
      return;
    }
    onDeleted?.(activity.id, activity.day_id);
  }

  function openInMaps() {
    if (!coords) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in">
      <div className="card-warm ornamental-border w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0', type.color)}>
              {type.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-xl font-bold text-ink-900 break-words">
                {activity.title}
              </h3>
              <p className="text-xs text-coral-500/80 mt-0.5">{type.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-ink-900">
          {activity.start_time && (
            <div className="flex items-center gap-2 text-coral-600 font-mono">
              <span className="text-xs uppercase tracking-wide text-sage-600 font-sans">Time</span>
              <span>{formatTime(activity.start_time)}</span>
            </div>
          )}

          {activity.location_name && (
            <div>
              <p className="text-xs uppercase tracking-wide text-sage-600 mb-1">Location</p>
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-coral-500 mt-0.5 shrink-0" />
                <span className="break-words">{activity.location_name}</span>
              </p>
              {coords && (
                <button
                  type="button"
                  onClick={openInMaps}
                  className="mt-2 text-xs text-coral-600 hover:text-coral-700 underline"
                >
                  Open in Google Maps
                </button>
              )}
            </div>
          )}

          {activity.notes && (
            <div>
              <p className="text-xs uppercase tracking-wide text-sage-600 mb-1">Notes</p>
              <p className="whitespace-pre-wrap break-words text-sage-800">{activity.notes}</p>
            </div>
          )}

          {!activity.start_time && !activity.location_name && !activity.notes && (
            <p className="text-sm text-sage-500 italic">No additional details.</p>
          )}
        </div>

        <div className="flex gap-2 pt-5 mt-4 border-t border-surface-200">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-2 text-sm text-coral-600 hover:bg-coral-50 rounded-lg transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>{deleting ? 'Deleting...' : 'Delete'}</span>
          </button>
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Close</button>
          <button type="button" onClick={onEdit} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Pencil className="w-4 h-4" />
            <span>Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityModal({ mode = 'create', dayId, tripId, tripCountry, activity, onClose, onAdded, onUpdated }) {
  const isEdit = mode === 'edit' && activity;
  const [title, setTitle] = useState(isEdit ? activity.title || '' : '');
  const [type, setType] = useState(isEdit ? activity.type || 'attraction' : 'attraction');
  const [startTime, setStartTime] = useState(isEdit ? (activity.start_time || '').slice(0, 5) : '');
  const [locationName, setLocationName] = useState(isEdit ? activity.location_name || '' : '');
  const [locationCoords, setLocationCoords] = useState(() =>
    isEdit ? parseCoords(activity.location_coords) : null
  );
  const [notes, setNotes] = useState(isEdit ? activity.notes || '' : '');
  const [saving, setSaving] = useState(false);

  function handleLocationSelect({ name, coords }) {
    setLocationName(name);
    setLocationCoords(coords);
  }

  function handleLocationChange(text) {
    setLocationName(text);
    // If the user manually edits the text after picking a suggestion, drop the
    // saved coords — they no longer match the displayed name.
    if (locationCoords) setLocationCoords(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title,
        type,
        start_time: startTime || null,
        location_name: locationName || null,
        location_coords: locationCoords
          ? `POINT(${locationCoords.lng} ${locationCoords.lat})`
          : null,
        notes: notes || null,
      };

      if (isEdit) {
        const { data, error } = await supabase
          .from('activities')
          .update(payload)
          .eq('id', activity.id)
          .select()
          .single();
        if (error) throw error;
        onUpdated?.(data);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('activities')
          .insert({
            trip_id: tripId,
            day_id: dayId,
            ...payload,
            created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        onAdded?.(data);
        onClose();
      }
    } catch (err) {
      alert(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in">
      <div className="card-warm ornamental-border w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold">{isEdit ? 'Edit Activity' : 'New Activity'}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">What are we doing?</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus={!isEdit}
              className="input-field"
              placeholder="Dinner at the restaurant"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Type</label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {Object.entries(ACTIVITY_TYPES).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={cn(
                    'p-2.5 rounded-xl border transition-all flex flex-col items-center gap-1',
                    type === key
                      ? 'bg-gradient-teal border-teal-500 text-white shadow-teal'
                      : 'bg-surface-100 border-surface-200 text-sage-700 hover:border-teal-400'
                  )}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-[10px]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-32 flex-shrink-0">
              <label className="block text-sm font-medium text-sage-700 mb-2">Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-field h-12 appearance-none"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-sage-700 mb-2">
                Location
                {locationCoords && (
                  <span className="ml-1 text-xs text-teal-600 font-normal">📍 pinned</span>
                )}
              </label>
              <LocationSearchInput
                value={locationName}
                onChange={handleLocationChange}
                onSelect={handleLocationSelect}
                onClear={() => setLocationCoords(null)}
                country={tripCountry}
                placeholder="Search a place..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="Additional details..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
