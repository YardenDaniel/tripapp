import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPinned, MessageSquare, Phone, Coins, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, cn } from '../lib/utils';
import LoadingScreen from '../components/LoadingScreen';
import ItineraryTab from '../components/ItineraryTab';
import MemoriesMapTab from '../components/MemoriesMapTab';
import ChatTab from '../components/ChatTab';
import EmergencyTab from '../components/EmergencyTab';
import CurrencyTab from '../components/CurrencyTab';
import MembersTab from '../components/MembersTab';

const TABS = [
  { id: 'itinerary', label: 'Schedule', icon: Calendar },
  { id: 'map', label: 'Memory Map', icon: MapPinned },
  { id: 'chat', label: 'Assistant', icon: MessageSquare },
  { id: 'currency', label: 'Currency', icon: Coins },
  { id: 'emergency', label: 'Emergency', icon: Phone },
  { id: 'members', label: 'Travelers', icon: Users },
];

export default function TripPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('itinerary');

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  async function loadTrip() {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error) throw error;
      setTrip(data);
    } catch (err) {
      console.error('Error loading trip:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingScreen message="Loading trip..." />;
  if (!trip) return null;

  return (
    <div className="min-h-screen pb-24 grain">
      <header className="relative h-44 overflow-hidden">
        {trip.cover_image_url ? (
          <img src={trip.cover_image_url} alt={trip.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-sunset" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-ink-900/60" />

        <Link
          to="/"
          className="absolute top-4 left-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-ink-900/60 backdrop-blur-md border border-coral-500/30 text-cream-50 safe-area-inset-top"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="absolute bottom-0 inset-x-0 p-4">
          <h1 className="font-display text-3xl font-bold text-cream-50 leading-tight">
            {trip.name}
          </h1>
          <p className="text-sm text-sage-300 mt-1">
            {trip.country} • {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
          </p>
        </div>
      </header>

      <div className="sticky top-0 z-20 bg-surface-100/90 backdrop-blur-xl border-b border-surface-200">
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[80px]',
                    isActive
                      ? 'bg-gradient-teal text-white shadow-teal'
                      : 'text-sage-600 hover:text-ink-900 hover:bg-surface-200'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-5 pt-6">
        {activeTab === 'itinerary' && <ItineraryTab trip={trip} />}
        {activeTab === 'map' && <MemoriesMapTab trip={trip} />}
        {activeTab === 'chat' && <ChatTab trip={trip} />}
        {activeTab === 'currency' && <CurrencyTab trip={trip} />}
        {activeTab === 'emergency' && <EmergencyTab trip={trip} />}
        {activeTab === 'members' && <MembersTab trip={trip} />}
      </main>
    </div>
  );
}
