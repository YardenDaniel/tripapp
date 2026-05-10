import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, MapPin, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, cn } from '../lib/utils';
import { getCountry } from '../lib/countries';
import Logo from '../components/Logo';
import LoadingScreen from '../components/LoadingScreen';

const PENDING_TOKEN_KEY = 'pendingInviteToken';

export default function JoinTripPage() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  // Save the token so it survives email-verification redirects (the user
  // signs up here, clicks the email link, lands back at the site URL —
  // we re-read the token from storage and resume).
  useEffect(() => {
    if (token) localStorage.setItem(PENDING_TOKEN_KEY, token);
  }, [token]);

  // Load invite preview (works for unauthenticated visitors too via the
  // SECURITY DEFINER RPC).
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc('get_invite_preview', { p_token: token });
      if (error) {
        setPreviewError(error.message || 'Could not load invite');
      } else if (!data || data.length === 0) {
        setPreviewError('This invite link is invalid or has been deleted');
      } else {
        setPreview(data[0]);
        if (data[0].expired) setPreviewError('This invite has expired');
      }
      setPreviewLoading(false);
    })();
  }, [token]);

  // Auto-accept once authenticated.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!preview || preview.expired) return;
    if (accepting) return;
    (async () => {
      setAccepting(true);
      const { data: tripId, error } = await supabase.rpc('accept_trip_invite', { p_token: token });
      if (error) {
        setAcceptError(error.message || 'Could not join the trip');
        setAccepting(false);
        return;
      }
      localStorage.removeItem(PENDING_TOKEN_KEY);
      navigate(`/trips/${tripId}`, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, preview]);

  if (authLoading || previewLoading) return <LoadingScreen message="Loading invite..." />;

  if (previewError) {
    return (
      <CenteredCard>
        <h2 className="font-display text-2xl font-bold mb-2">Invite unavailable</h2>
        <p className="text-sm text-sage-600 mb-6">{previewError}</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <span>Go to TripApp</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </CenteredCard>
    );
  }

  if (user && accepting) {
    return <LoadingScreen message="Joining trip..." />;
  }

  if (user && acceptError) {
    return (
      <CenteredCard>
        <h2 className="font-display text-2xl font-bold mb-2">Could not join</h2>
        <p className="text-sm text-coral-700 mb-6">{acceptError}</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <span>Go to TripApp</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </CenteredCard>
    );
  }

  // Unauthenticated — show preview + sign-up/sign-in.
  return (
    <div className="min-h-screen flex flex-col grain p-6">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6"><Logo size="lg" /></div>
          </div>

          <InvitePreview preview={preview} />

          <div className="card-warm ornamental-border mt-4">
            <p className="text-sm text-sage-700 mb-4 text-center">
              Sign up or sign in to join this trip.
            </p>
            <InlineAuthForm />
          </div>
        </div>
      </div>
    </div>
  );
}

function CenteredCard({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 grain">
      <div className="card-warm ornamental-border max-w-md w-full text-center animate-slide-up">
        <div className="flex justify-center mb-6"><Logo size="lg" /></div>
        {children}
      </div>
    </div>
  );
}

function InvitePreview({ preview }) {
  const country = getCountry(preview.trip_country);
  return (
    <div className="card-warm overflow-hidden p-0">
      {preview.trip_cover_image_url ? (
        <div className="h-32 relative">
          <img
            src={preview.trip_cover_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 to-transparent" />
        </div>
      ) : (
        <div className="h-20 bg-gradient-sunset" />
      )}
      <div className="p-5">
        <p className="text-xs text-coral-500/80 mb-1">
          {preview.inviter_name || 'Someone'} invited you to
        </p>
        <h2 className="font-display text-2xl font-bold mb-3 leading-tight">
          {preview.trip_name}
        </h2>
        <div className="space-y-1.5 text-sm text-sage-700">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-coral-500/70" />
            <span>
              {country?.flag ? `${country.flag} ` : ''}
              {preview.trip_country}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-coral-500/70" />
            <span>{formatDate(preview.trip_start_date)} – {formatDate(preview.trip_end_date)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineAuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        // Pass emailRedirectTo so the verification email link brings the
        // user back to /join/:token (instead of the project's site root).
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.href,
          },
        });
        setSuccess('Account created. Check your email to verify, then come back.');
      } else {
        await signIn({ email, password });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex bg-surface-100 border border-surface-200 rounded-xl p-1 mb-4">
        <button
          type="button"
          onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            mode === 'signup' ? 'bg-gradient-teal text-white' : 'text-sage-600'
          )}
        >
          Sign Up
        </button>
        <button
          type="button"
          onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            mode === 'signin' ? 'bg-gradient-teal text-white' : 'text-sage-600'
          )}
        >
          Sign In
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="input-field pl-11"
              placeholder="Full name"
            />
          </div>
        )}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-field pl-11"
            placeholder="you@example.com"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="input-field pl-11 pr-11"
            placeholder="Password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-coral-500/60 hover:text-coral-500"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-coral-100 border border-coral-300 rounded-lg text-sm text-coral-700">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 bg-teal-100 border border-teal-300 rounded-lg text-sm text-teal-800">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <span>{mode === 'signup' ? 'Sign up & join' : 'Sign in & join'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </>
  );
}
