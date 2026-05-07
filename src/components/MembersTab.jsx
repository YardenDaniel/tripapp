import { useEffect, useState } from 'react';
import { UserPlus, X, Crown, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export default function MembersTab({ trip }) {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const isOwner = trip.owner_id === user.id;

  useEffect(() => {
    loadMembers();
  }, [trip.id]);

  async function loadMembers() {
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          *,
          profile:profiles!trip_members_user_id_fkey (
            id, full_name, email, avatar_url
          )
        `)
        .eq('trip_id', trip.id);

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(memberId) {
    if (!confirm('Remove this traveler from the trip?')) return;
    await supabase.from('trip_members').delete().eq('id', memberId);
    loadMembers();
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="card-warm ornamental-border">
        <h2 className="font-display text-lg font-bold mb-1">Trip Travelers</h2>
        <p className="text-xs text-coral-500/70">
          Everyone with access sees everything in real time
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isOwner={isOwner}
              currentUserId={user.id}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {isOwner && (
        <button
          onClick={() => setShowInvite(true)}
          className="w-full py-3 border border-dashed border-coral-500/30 rounded-xl text-coral-500/80 hover:border-coral-500/60 hover:bg-coral-500/5 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Traveler</span>
        </button>
      )}

      {showInvite && (
        <InviteModal
          trip={trip}
          existingEmails={members.map((m) => m.profile?.email).filter(Boolean)}
          onClose={() => { setShowInvite(false); loadMembers(); }}
        />
      )}
    </div>
  );
}

function MemberCard({ member, isOwner, currentUserId, onRemove }) {
  const profile = member.profile;
  if (!profile) return null;

  const isCurrentUser = profile.id === currentUserId;
  const isOwnerRole = member.role === 'owner';

  return (
    <div className="card-warm flex items-center gap-3 group">
      <div className="w-12 h-12 rounded-full bg-gradient-teal flex items-center justify-center font-display font-bold text-cream-50 shrink-0 border border-coral-500/30">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          (profile.full_name || profile.email)[0].toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-cream-50 truncate">
            {profile.full_name || profile.email}
            {isCurrentUser && <span className="text-xs text-coral-500/70 ml-1">(you)</span>}
          </h3>
          {isOwnerRole && (
            <Crown className="w-4 h-4 text-coral-500" aria-label="Owner" />
          )}
        </div>
        <p className="text-xs text-cream-100/50 truncate">{profile.email}</p>
      </div>
      {isOwner && !isOwnerRole && (
        <button
          onClick={() => onRemove(member.id)}
          className="opacity-0 group-hover:opacity-100 p-2 text-teal-400 hover:bg-teal-900/40 rounded-lg transition-all"
          aria-label="Remove"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function InviteModal({ trip, existingEmails, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleInvite(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (existingEmails.includes(email.toLowerCase())) {
      setError('This traveler is already in the trip');
      return;
    }

    setLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email.toLowerCase())
        .single();

      if (profileError || !profile) {
        setError("No user found with this email. Make sure they signed up to the app.");
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('trip_members').insert({
        trip_id: trip.id,
        user_id: profile.id,
        role: 'editor',
      });

      if (insertError) throw insertError;

      setSuccess('Added successfully!');
      setTimeout(onClose, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in">
      <div className="card-warm ornamental-border w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold">Invite to Trip</h3>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-cream-100/70 mb-4 leading-relaxed">
          Add a traveler to your trip. They'll see everything in real time.
          <br />
          <span className="text-xs text-coral-500/70">
            ⚠️ They need to sign up to the app first
          </span>
        </p>

        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-cream-100/80 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="input-field"
              placeholder="partner@example.com"
            />
          </div>

          {error && (
            <div className="p-3 bg-teal-900/40 border border-teal-700/40 rounded-lg text-sm text-teal-200">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-sage-700/20 border border-sage-500/40 rounded-lg text-sm text-sage-50">
              {success}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
