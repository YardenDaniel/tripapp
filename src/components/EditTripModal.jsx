import { useEffect, useState } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CountryCombobox from './CountryCombobox';

// Edits the textual fields of a trip: name, country, dates, description.
// Cover image is handled separately by CoverEditFlow (see TripActionsMenu).
export default function EditTripModal({ trip, open, onClose, onUpdated, onDeleted }) {
  const { user } = useAuth();
  const isOwner = !!user && user.id === trip.owner_id;
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // Reset state whenever the modal is (re)opened on a new trip.
  useEffect(() => {
    if (!open) return;
    setName(trip.name || '');
    setCountry(trip.country || '');
    setStartDate(trip.start_date || '');
    setEndDate(trip.end_date || '');
    setDescription(trip.description || '');
    setError('');
  }, [open, trip.id]);

  if (!open) return null;

  async function handleSave(e) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !country.trim()) {
      setError('Trip name and country are required.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date must be on or after the start date.');
      return;
    }

    setSaving(true);
    try {
      const { data, error: updateError } = await supabase
        .from('trips')
        .update({
          name: name.trim(),
          country: country.trim(),
          start_date: startDate,
          end_date: endDate,
          description: description.trim() || null,
        })
        .eq('id', trip.id)
        .select()
        .single();

      if (updateError) throw updateError;
      onUpdated?.(data);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isOwner) return;
    const ok = window.confirm(
      `Delete "${trip.name}"? This will permanently remove the trip, its days, activities, and memories. This cannot be undone.`,
    );
    if (!ok) return;
    setError('');
    setDeleting(true);
    try {
      const { error: deleteError } = await supabase
        .from('trips')
        .delete()
        .eq('id', trip.id);
      if (deleteError) throw deleteError;
      onDeleted?.(trip.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not delete trip.');
    } finally {
      setDeleting(false);
    }
  }

  const datesChanged = startDate !== trip.start_date || endDate !== trip.end_date;
  const countryChanged = country.trim() !== trip.country;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in">
      <div className="card-warm ornamental-border w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold text-ink-900">Edit Trip</h3>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Trip Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input-field"
              placeholder="My Epic Vietnam Trip"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Country</label>
            <CountryCombobox value={country} onChange={setCountry} />
            {countryChanged && (
              <p className="text-xs text-sage-500 mt-1.5">
                Existing memories keep their location. Emergency contacts won't auto-update.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Dates</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="input-field h-12 appearance-none min-w-0"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
                className="input-field h-12 appearance-none min-w-0"
              />
            </div>
            {datesChanged && (
              <p className="text-xs text-sage-500 mt-1.5">
                Existing day cards stay as-is. Add or remove days from the Schedule tab if needed.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="A few words about the trip..."
            />
          </div>

          {error && (
            <div className="p-3 bg-coral-100 border border-coral-300 rounded-lg text-sm text-coral-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving || deleting} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving || deleting} className="btn-coral flex-1 flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>

        {isOwner && (
          <div className="mt-6 pt-4 border-t border-surface-200">
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm text-coral-700 hover:text-coral-800 hover:bg-coral-50 rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>{deleting ? 'Deleting...' : 'Delete this trip'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
