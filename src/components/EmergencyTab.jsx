import { useEffect, useState } from 'react';
import { Phone, Plus, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EMERGENCY_TYPE_ICONS, cn } from '../lib/utils';

const TYPE_LABELS = {
  police: 'Police',
  ambulance: 'Ambulance',
  fire: 'Fire',
  embassy: 'Embassy',
  insurance: 'Insurance',
  other: 'Other',
};

export default function EmergencyTab({ trip }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [trip.id]);

  async function loadContacts() {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .or(`and(country.eq.${trip.country},is_default.eq.true),trip_id.eq.${trip.id}`)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this contact?')) return;
    await supabase.from('emergency_contacts').delete().eq('id', id);
    loadContacts();
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="card-warm ornamental-border">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🆘</div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">In Case of Emergency</h2>
            <p className="text-xs text-sage-600 mt-0.5">
              Tap a number to launch your phone dialer
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="w-full py-3 border border-dashed border-coral-500/30 rounded-xl text-coral-500/80 hover:border-coral-500/60 hover:bg-coral-500/5 transition-all flex items-center justify-center gap-2 text-sm"
      >
        <Plus className="w-4 h-4" />
        <span>Add Emergency Contact</span>
      </button>

      {showAdd && <AddContactModal trip={trip} onClose={() => { setShowAdd(false); loadContacts(); }} />}
    </div>
  );
}

function ContactCard({ contact, onDelete }) {
  return (
    <a
      href={`tel:${contact.number.replace(/\s/g, '')}`}
      className="card-warm flex items-center gap-4 hover:border-coral-500/30 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center text-2xl shrink-0 border border-coral-500/20">
        {EMERGENCY_TYPE_ICONS[contact.type] || '📞'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-ink-900 truncate">{contact.name}</h3>
          {contact.is_default && (
            <span className="text-[10px] px-1.5 py-0.5 bg-coral-500/20 text-coral-500 rounded">Official</span>
          )}
        </div>
        <p className="text-sm font-mono text-coral-500 mt-0.5">{contact.number}</p>
        {contact.description && (
          <p className="text-xs text-sage-600 mt-0.5">{contact.description}</p>
        )}
      </div>
      <Phone className="w-5 h-5 text-coral-500/60 group-hover:text-coral-500 group-hover:scale-110 transition-all shrink-0" />
      {!contact.is_default && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete(contact.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-coral-600 hover:bg-coral-50 rounded-lg transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </a>
  );
}

function AddContactModal({ trip, onClose }) {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState('insurance');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('emergency_contacts').insert({
        trip_id: trip.id,
        country: trip.country,
        name,
        number,
        type,
        description: description || null,
        is_default: false,
      });
      if (error) throw error;
      onClose();
    } catch (err) {
      alert(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-ink-900/80 backdrop-blur-sm animate-fade-in">
      <div className="card-warm ornamental-border w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold">Emergency Contact</h3>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="input-field"
              placeholder="Travel Insurance Company"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
              className="input-field"
              placeholder="+1-555-123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={cn(
                    'p-2.5 rounded-xl border transition-all flex flex-col items-center gap-1',
                    type === key
                      ? 'bg-gradient-teal text-white border-coral-500/40'
                      : 'bg-surface-100 text-sage-700 border-surface-200 hover:border-coral-500/40 hover:bg-surface-200'
                  )}
                >
                  <span className="text-xl">{EMERGENCY_TYPE_ICONS[key]}</span>
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-2">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="Additional details"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
