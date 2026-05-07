import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPinned, MessageSquare, Phone, Coins, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, cn } from '../lib/utils';
import LoadingScreen from '../components/LoadingScreen';
import CoverImageUpload from '../components/CoverImageUpload';
import TripActionsMenu from '../components/TripActionsMenu';
import EditTripModal from '../components/EditTripModal';
import CoverEditFlow from '../components/CoverEditFlow';
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

const TAB_IDS = TABS.map((t) => t.id);
const DEFAULT_TAB = 'itinerary';

export default function TripPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const activeTab = TAB_IDS.includes(tabFromUrl) ? tabFromUrl : DEFAULT_TAB;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  // Tabs stay mounted once visited so switching doesn't unmount and refetch.
  // Reduces layout reflow and preserves scroll/state inside each tab.
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([activeTab]));
  const coverEditRef = useRef(null);

  function handleSelectTab(id) {
    // Mark visited synchronously so the new tab renders in the SAME frame
    // as the URL update — avoids an empty-main render between activeTab
    // changing and the useEffect adding it to visitedTabs.
    setVisitedTabs((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', id);
        return next;
      },
      { replace: true },
    );
  }

  // Backup: handles URL-driven tab changes (browser back/forward, deep links)
  // that bypass handleSelectTab.
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  function handleMenuAction(action) {
    if (action === 'cover') {
      coverEditRef.current?.open();
    } else if (action === 'details') {
      setEditOpen(true);
    }
  }

  function handleTripUpdated(updated) {
    setTrip((prev) => (prev ? { ...prev, ...updated } : prev));
  }

  function handleCoverUpdated(url) {
    setTrip((prev) => (prev ? { ...prev, cover_image_url: url } : prev));
  }

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
      {/* Wrap the cover + the kebab so the kebab dropdown isn't clipped by
          the cover's overflow-hidden. */}
      <div className="relative">
        <CoverImageUpload
          imageUrl={trip.cover_image_url}
          onFileSelected={() => {}}
          hideCamera
          className="h-64"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-ink-900/60 pointer-events-none" />

          <Link
            to="/"
            className="absolute top-4 left-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-ink-900/60 backdrop-blur-md border border-coral-500/30 text-cream-50 safe-area-inset-top"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="absolute bottom-0 inset-x-0 p-4 z-10">
            <h1 className="font-display text-3xl font-bold text-cream-50 leading-tight">
              {trip.name}
            </h1>
            <p className="text-sm text-sage-300 mt-1">
              {trip.country} • {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
            </p>
          </div>
        </CoverImageUpload>

        <div className="absolute top-4 right-4 z-30 safe-area-inset-top">
          <TripActionsMenu onEdit={handleMenuAction} />
        </div>
      </div>

      <EditTripModal
        trip={trip}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={handleTripUpdated}
        onDeleted={() => navigate('/')}
      />

      <CoverEditFlow
        ref={coverEditRef}
        tripId={trip.id}
        onUpdated={handleCoverUpdated}
      />

      <div className="sticky top-0 z-20 bg-surface-100/90 backdrop-blur-xl border-b border-surface-200">
        <div className="max-w-2xl mx-auto overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
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

      <main className="max-w-2xl mx-auto px-5 pt-6 min-h-[calc(100vh-280px)]">
        {visitedTabs.has('itinerary') && (
          <div className={activeTab === 'itinerary' ? '' : 'hidden'}>
            <ItineraryTab trip={trip} />
          </div>
        )}
        {visitedTabs.has('map') && (
          <div className={activeTab === 'map' ? '' : 'hidden'}>
            <MemoriesMapTab trip={trip} />
          </div>
        )}
        {visitedTabs.has('chat') && (
          <div className={activeTab === 'chat' ? '' : 'hidden'}>
            <ChatTab trip={trip} />
          </div>
        )}
        {visitedTabs.has('currency') && (
          <div className={activeTab === 'currency' ? '' : 'hidden'}>
            <CurrencyTab trip={trip} />
          </div>
        )}
        {visitedTabs.has('emergency') && (
          <div className={activeTab === 'emergency' ? '' : 'hidden'}>
            <EmergencyTab trip={trip} />
          </div>
        )}
        {visitedTabs.has('members') && (
          <div className={activeTab === 'members' ? '' : 'hidden'}>
            <MembersTab trip={trip} />
          </div>
        )}
      </main>
    </div>
  );
}
