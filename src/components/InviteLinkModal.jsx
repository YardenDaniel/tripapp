import { useEffect, useState } from 'react';
import { X, Copy, Check, Loader2, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function InviteLinkModal({ trip, onClose }) {
  const { user } = useAuth();
  const [token, setToken] = useState(null);
  const [creating, setCreating] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    createInvite();
  }, []);

  async function createInvite() {
    setCreating(true);
    setError('');
    try {
      // Reuse an active invite if one exists for this trip, so the link
      // stays stable if the modal is reopened. Fall back to creating one.
      const nowIso = new Date().toISOString();
      const { data: existing } = await supabase
        .from('trip_invites')
        .select('token')
        .eq('trip_id', trip.id)
        .eq('created_by', user.id)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        setToken(existing[0].token);
        return;
      }

      const newToken = generateToken();
      const { error: insertError } = await supabase.from('trip_invites').insert({
        trip_id: trip.id,
        token: newToken,
        created_by: user.id,
      });
      if (insertError) throw insertError;
      setToken(newToken);
    } catch (err) {
      setError(err.message || 'Could not generate invite link');
    } finally {
      setCreating(false);
    }
  }

  const inviteUrl = token ? `${window.location.origin}/join/${token}` : '';

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers.
      const ta = document.createElement('textarea');
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function whatsappShareUrl() {
    const text = `Join my trip "${trip.name}" on TripApp:\n${inviteUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in">
      <div className="card-warm ornamental-border w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-coral-500" />
            Share invite link
          </h3>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-sage-600 mb-4 leading-relaxed">
          Anyone with this link can join the trip. They'll be added as soon
          as they sign in (or sign up).
        </p>

        {creating ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-coral-500" />
          </div>
        ) : error ? (
          <div className="p-3 bg-coral-100 border border-coral-300 rounded-lg text-sm text-coral-700">
            {error}
          </div>
        ) : (
          <>
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-sage-500 mb-1">Invite link</p>
              <p className="text-sm text-ink-900 break-all font-mono">{inviteUrl}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-ghost flex-1 flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-teal-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy link</span>
                  </>
                )}
              </button>
              <a
                href={whatsappShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <span>WhatsApp</span>
              </a>
            </div>

            <p className="text-xs text-sage-500 mt-4 text-center">
              Link expires in 30 days
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// Random URL-safe token. ~22 chars, ~132 bits of entropy — easily
// unguessable but short enough for WhatsApp.
function generateToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
