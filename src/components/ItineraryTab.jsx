import { useEffect, useState } from 'react';
import { Plus, MapPin, X, Trash2, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, formatTime, ACTIVITY_TYPES, cn } from '../lib/utils';

export default function ItineraryTab({ trip }) {
  const [days, setDays] = useState([]);
  const [activities, setActivities] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);
  const [showAddActivity, setShowAddActivity] = useState(null);

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
      setDays(data || []);
      if (data?.[0]) setExpandedDay(data[0].id);
      await loadActivities();
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
      return;
    }

    const grouped = {};
    data.forEach((act) => {
      if (!grouped[act.day_id]) grouped[act.day_id] = [];
      grouped[act.day_id].push(act);
    });
    setActivities(grouped);
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
        />
      ))}

      {showAddActivity && (
        <ActivityModal
          dayId={showAddActivity}
          tripId={trip.id}
          onClose={() => setShowAddActivity(null)}
        />
      )}
    </div>
  );
}

function DayCard({ day, activities, isExpanded, onToggle, onAddActivity }) {
  const dayDate = new Date(day.date);
  const isToday = dayDate.toDateString() === new Date().toDateString();
  const isPast = dayDate < new Date() && !isToday;

  return (
    <div className={cn(
      'card-warm transition-all duration-300',
      isToday && 'ring-2 ring-coral-500/40',
      isPast && 'opacity-70'
    )}>
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-display',
            isToday
              ? 'bg-gradient-coral text-white'
              : 'bg-teal-100 text-teal-800 border border-teal-200'
          )}>
            <span className="text-xs font-accent italic leading-none">Day</span>
            <span className="text-xl font-bold leading-none">{day.day_number}</span>
          </div>
          <div className="text-left">
            <p className="font-display text-lg font-semibold text-ink-900">
              {day.title || formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="text-xs text-sage-600 mt-0.5">
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
              {isToday && <span className="text-coral-600 ml-2">· Today</span>}
            </p>
          </div>
        </div>
        <ChevronDown className={cn(
          'w-5 h-5 text-sage-500 transition-transform',
          isExpanded && 'rotate-180'
        )} />
      </button>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-surface-200 animate-fade-in">
          {activities.length === 0 ? (
            <p className="text-sm text-sage-400 text-center py-4 font-accent italic">
              No activities yet for this day
            </p>
          ) : (
            <div className="space-y-2">
              {activities.map((activity) => (
                <ActivityRow key={activity.id} activity={activity} />
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

function ActivityRow({ activity }) {
  const type = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.other;

  async function handleDelete() {
    if (!confirm('Delete this activity?')) return;
    await supabase.from('activities').delete().eq('id', activity.id);
  }

  return (
    <div className="flex gap-3 p-3 bg-surface-100 rounded-xl border border-surface-200 group">
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
          <p className="text-xs text-sage-500 mt-1 line-clamp-2">{activity.notes}</p>
        )}
      </div>
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-coral-600 hover:bg-coral-50 rounded-lg transition-all"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function ActivityModal({ dayId, tripId, onClose }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('attraction');
  const [startTime, setStartTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('activities').insert({
        trip_id: tripId,
        day_id: dayId,
        title,
        type,
        start_time: startTime || null,
        location_name: locationName || null,
        notes: notes || null,
        created_by: user.id,
      });
      if (error) throw error;
      onClose();
    } catch (err) {
      alert(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in">
      <div className="card-warm ornamental-border w-full max-w-md animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold">New Activity</h3>
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
              autoFocus
              className="input-field"
              placeholder="Dinner at the restaurant"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Type</label>
            <div className="grid grid-cols-5 gap-2">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">Location</label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="input-field"
                placeholder="Place name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input-field resize-none"
              placeholder="Additional details..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
