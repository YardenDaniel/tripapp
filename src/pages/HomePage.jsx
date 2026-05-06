import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Calendar, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatDate, daysBetween } from '../lib/utils';
import Logo from '../components/Logo';
import LoadingScreen from '../components/LoadingScreen';

export default function HomePage() {
  const { signOut } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select(`*, trip_members(count)`)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setTrips(data || []);
    } catch (err) {
      console.error('Error loading trips:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen message="Loading your trips..." />;

  const upcomingTrips = trips.filter((t) => new Date(t.end_date) >= new Date());
  const pastTrips = trips.filter((t) => new Date(t.end_date) < new Date());

  return (
    <div className="min-h-screen pb-20 grain">
      <header className="sticky top-0 z-30 bg-surface-100/90 backdrop-blur-xl border-b border-surface-200 safe-area-inset-top">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <button onClick={signOut} className="btn-ghost p-2" title="Sign Out" aria-label="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-8">
        {upcomingTrips.length > 0 && (
          <section className="mb-10">
            <h2 className="font-display text-xl font-semibold mb-4 text-coral-500">
              Upcoming Trips
            </h2>
            <div className="space-y-4">
              {upcomingTrips.map((trip, i) => (
                <TripCard key={trip.id} trip={trip} delay={i * 0.05} />
              ))}
            </div>
          </section>
        )}

        {trips.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-teal flex items-center justify-center shadow-teal">
              <MapPin className="w-12 h-12 text-white" />
            </div>
            <h2 className="font-display text-2xl font-bold mb-3">Your journey starts here</h2>
            <p className="text-sage-600 mb-8 max-w-sm mx-auto leading-relaxed">
              No trips yet. Let's create your first trip and start documenting the adventure.
            </p>
            <Link to="/trips/new" className="btn-coral inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              <span>New Trip</span>
            </Link>
          </div>
        )}

        {pastTrips.length > 0 && (
          <section className="mb-10">
            <h2 className="font-display text-xl font-semibold mb-4 text-sage-600">
              Past Trips
            </h2>
            <div className="space-y-4 opacity-80">
              {pastTrips.map((trip, i) => (
                <TripCard key={trip.id} trip={trip} delay={i * 0.05} />
              ))}
            </div>
          </section>
        )}
      </main>

      {trips.length > 0 && (
        <Link
          to="/trips/new"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 btn-coral flex items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
          <span>New Trip</span>
        </Link>
      )}
    </div>
  );
}

function TripCard({ trip, delay = 0 }) {
  const totalDays = daysBetween(trip.start_date, trip.end_date);
  const isFuture = new Date(trip.start_date) > new Date();
  const daysUntil = Math.ceil((new Date(trip.start_date) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="block animate-slide-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="card-warm ornamental-border hover:border-coral-500/40 transition-all duration-300 group">
        <div className="relative -mx-5 -mt-5 mb-4 h-32 overflow-hidden rounded-t-2xl">
          {trip.cover_image_url ? (
            <img
              src={trip.cover_image_url}
              alt={trip.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-sunset" />
          )}
          {isFuture && daysUntil > 0 && daysUntil <= 30 && (
            <div className="absolute top-3 right-3 px-3 py-1 bg-coral-500 text-white text-xs font-bold rounded-full shadow-coral">
              In {daysUntil} days
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-display text-xl font-bold text-ink-900 leading-tight">
              {trip.name}
            </h3>
            <span className="text-xs text-coral-600 font-accent italic mt-1 whitespace-nowrap">
              {trip.country}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-sage-600 mt-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-teal-500" />
              <span>{formatDate(trip.start_date, { month: 'short', day: 'numeric' })}</span>
              <span className="text-sage-400">→</span>
              <span>{formatDate(trip.end_date, { month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sage-400">·</span>
              <span>{totalDays} days</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
