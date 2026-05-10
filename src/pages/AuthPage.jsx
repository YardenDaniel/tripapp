import { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { cn } from '../lib/utils';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin');
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
        await signUp({ email, password, fullName });
        setSuccess('Account created! Check your email to verify.');
      } else {
        await signIn({ email, password });
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col grain relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="vietnamese-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1" fill="#f97316" />
              <circle cx="0" cy="0" r="0.5" fill="#f97316" />
              <circle cx="60" cy="60" r="0.5" fill="#f97316" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#vietnamese-pattern)" />
        </svg>
      </div>

      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-coral-500/40 to-transparent" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <Logo size="xl" />
            </div>
            <p className="text-coral-500/80 text-lg">
              {mode === 'signin' ? 'Welcome back' : 'Welcome aboard'}
            </p>
            <div className="coral-divider w-32 mx-auto mt-3" />
          </div>

          <div className="card-warm ornamental-border">
            <div className="flex bg-surface-100 border border-surface-200 rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
                className={cn(
                  'flex-1 py-2.5 rounded-lg font-medium transition-all duration-300',
                  mode === 'signin'
                    ? 'bg-gradient-teal text-white shadow-teal'
                    : 'text-sage-600 hover:text-ink-900'
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                className={cn(
                  'flex-1 py-2.5 rounded-lg font-medium transition-all duration-300',
                  mode === 'signup'
                    ? 'bg-gradient-teal text-white shadow-teal'
                    : 'text-sage-600 hover:text-ink-900'
                )}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium text-sage-700 mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="input-field pl-11"
                      placeholder="Jane Doe"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">Email</label>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-coral-500/60" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="input-field pl-11 pr-11"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-coral-500/60 hover:text-coral-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-coral-100 border border-coral-300 rounded-lg text-sm text-coral-700 animate-fade-in">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-teal-100 border border-teal-300 rounded-lg text-sm text-teal-800 animate-fade-in">
                  {success}
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
                    <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-sage-500 mt-8">
            "A journey of a thousand miles begins with a single step" — Lao Tzu
          </p>
        </div>
      </div>
    </div>
  );
}
