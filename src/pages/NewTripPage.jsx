import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Type, Loader2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateDayDates } from '../lib/utils';
import Logo from '../components/Logo';

const POPULAR_DESTINATIONS = [
  { name: 'Vietnam', emoji: '🇻🇳' },
  { name: 'Thailand', emoji: '🇹🇭' },
  { name: 'Japan', emoji: '🇯🇵' },
  { name: 'Italy', emoji: '🇮🇹' },
  { name: 'Greece', emoji: '🇬🇷' },
  { name: 'Portugal', emoji: '🇵🇹' },
];

export default function NewTripPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-10 grain">
      <header className="sticky top-0 z-30 bg-ink-900/80 backdrop-blur-xl border-b border-teal-900/30 safe-area-inset-top">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="btn-ghost p-2" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Logo size="sm" />
          <div className="w-9" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-8">
        <div className="mb-8 animate-fade-in">
          <p className="font-accent italic text-coral-500/80 text-lg">Let's plan your</p>
          <h1 className="font-display text-4xl font-bold mt-1">Next Adventure</h1>
          <div className="coral-divider w-24 mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up">
          <div>
            <label className="block text-sm font-medium text-cream-100/80 mb-2">Trip Name</label>
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
            <label className="block text-sm font-medium text-cream-100/80 mb-2">Destination</label>
            <div className="relative mb-3">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60" />
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                className="input-field pl-11"
                placeholder="Vietnam"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_DESTINATIONS.map((dest) => (
                <button
                  key={dest.name}
                  type="button"
                  onClick={() => setCountry(dest.name)}
                  className="px-3 py-1.5 text-sm bg-ink-800/60 border border-teal-900/40 rounded-full hover:border-coral-500/40 hover:bg-ink-700/60 transition-all"
                >
                  <span className="mr-1.5">{dest.emoji}</span>
                  {dest.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-cream-100/80 mb-2">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="input-field pl-11"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-cream-100/80 mb-2">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  min={startDate}
                  className="input-field pl-11"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-cream-100/80 mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="A few words about the trip..."
            />
          </div>

          {error && (
            <div className="p-3 bg-teal-900/40 border border-teal-700/40 rounded-lg text-sm text-teal-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2"
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
      </main>
    </div>
  );
}
