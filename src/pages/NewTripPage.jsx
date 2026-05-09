import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Type, Loader2, Plus, ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateDayDates } from '../lib/utils';
import { uploadCoverImage } from '../lib/imageUpload';
import { getCountry } from '../lib/countries';
import Logo from '../components/Logo';
import CoverImageUpload from '../components/CoverImageUpload';
import CountryCombobox from '../components/CountryCombobox';

// Suggested quick-pick destinations. Names must match countries.json so the
// flag and metadata are consistent everywhere. Falls back gracefully if a
// name is missing from the data file.
const POPULAR_NAMES = ['Vietnam', 'Thailand', 'Japan', 'Italy', 'Greece', 'Portugal', 'France', 'Spain'];
const POPULAR_DESTINATIONS = POPULAR_NAMES
  .map((name) => getCountry(name))
  .filter(Boolean);

export default function NewTripPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Phase 1: trip details. Phase 2 (after create): pick a cover.
  const [phase, setPhase] = useState('details');
  const [createdTrip, setCreatedTrip] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .insert({
          name,
          country,
          start_date: startDate,
          end_date: endDate,
          description: description || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (tripError) throw tripError;

      const days = generateDayDates(startDate, endDate).map((d) => ({
        ...d,
        trip_id: trip.id,
      }));

      const { error: daysError } = await supabase.from('itinerary_days').insert(days);
      if (daysError) console.error('Error creating days:', daysError);

      setCreatedTrip(trip);
      setPhase('cover');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Called from CoverImageUpload after the user picks + crops a cover.
  async function handleCoverPicked(blob) {
    if (!createdTrip) return;
    setUploadingCover(true);
    try {
      const url = await uploadCoverImage(blob, createdTrip.id);
      const { error: updateError } = await supabase
        .from('trips')
        .update({ cover_image_url: url })
        .eq('id', createdTrip.id);
      if (updateError) throw updateError;
      setCoverUrl(url);
    } catch (err) {
      alert('Could not save cover: ' + (err.message || 'unknown error'));
    } finally {
      setUploadingCover(false);
    }
  }

  function goToTrip() {
    if (createdTrip) navigate(`/trips/${createdTrip.id}`);
  }

  return (
    <div className="min-h-screen pb-10 grain">
      <header className="sticky top-0 z-30 bg-surface-100/90 backdrop-blur-xl border-b border-surface-200 safe-area-inset-top">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="btn-ghost p-2" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Logo size="sm" />
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-8">
        {phase === 'details' && (
          <>
            <div className="mb-8 animate-fade-in">
              <p className="text-coral-500/80 text-lg">Let's plan your</p>
              <h1 className="font-display text-4xl font-bold mt-1">Next Adventure</h1>
              <div className="coral-divider w-24 mt-3" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">Trip Name</label>
                <div className="relative">
                  <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="input-field pl-11"
                    placeholder="e.g., Honeymoon in Vietnam"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">Destination</label>
                <div className="mb-3">
                  <CountryCombobox value={country} onChange={setCountry} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_DESTINATIONS.map((dest) => (
                    <button
                      key={dest.code2}
                      type="button"
                      onClick={() => setCountry(dest.name)}
                      className="px-3 py-1.5 text-sm bg-surface-50 border border-surface-200 rounded-full hover:border-coral-500/40 hover:bg-surface-100 text-ink-900 transition-all"
                    >
                      <span className="mr-1.5">{dest.flag}</span>
                      {dest.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-sage-700 mb-2">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60 pointer-events-none" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="input-field pl-11 h-12 appearance-none"
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-sm font-medium text-sage-700 mb-2">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60 pointer-events-none" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      min={startDate}
                      className="input-field pl-11 h-12 appearance-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">Description (Optional)</label>
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

              <button
                type="submit"
                disabled={loading}
                className="btn-coral w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span>Create Trip</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {phase === 'cover' && createdTrip && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <p className="text-coral-500/80 text-lg">Almost there</p>
              <h1 className="font-display text-3xl font-bold mt-1">Pick a cover</h1>
              <p className="text-sm text-sage-600 mt-2">
                Add a photo for the trip. You can skip and add one later.
              </p>
            </div>

            <div className="space-y-4 animate-slide-up">
              <CoverImageUpload
                imageUrl={coverUrl}
                onFileSelected={handleCoverPicked}
                disabled={uploadingCover}
              />

              {uploadingCover && (
                <div className="p-3 bg-surface-100 border border-surface-200 rounded-lg text-sm text-sage-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-coral-500" />
                  Uploading cover...
                </div>
              )}

              <button
                type="button"
                onClick={goToTrip}
                disabled={uploadingCover}
                className="btn-coral w-full flex items-center justify-center gap-2"
              >
                {coverUrl ? (
                  <>
                    <ImageIcon className="w-5 h-5" />
                    <span>Continue</span>
                  </>
                ) : (
                  <span>Skip for now</span>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
