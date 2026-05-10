import { useEffect, useState } from 'react';
import { Plus, Trash2, Backpack, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export default function PackingTab({ trip }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadItems();

    const channel = supabase
      .channel(`trip-${trip.id}-equipment`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'equipment_items', filter: `trip_id=eq.${trip.id}` },
        () => loadItems()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [trip.id]);

  async function loadItems() {
    try {
      const { data, error } = await supabase
        .from('equipment_items')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at');
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error loading equipment:', err);
    } finally {
      setLoading(false);
    }
  }

  async function addItem(e) {
    e?.preventDefault();
    const name = newItemName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('equipment_items')
        .insert({ trip_id: trip.id, name, created_by: user?.id });
      if (error) throw error;
      setNewItemName('');
    } catch (err) {
      alert('Could not add item: ' + (err.message || 'unknown error'));
    } finally {
      setAdding(false);
    }
  }

  async function togglePacked(item) {
    const next = !item.packed;
    // Optimistic update so the checkbox feels instant.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, packed: next } : i)));
    const { error } = await supabase
      .from('equipment_items')
      .update({ packed: next })
      .eq('id', item.id);
    if (error) {
      // Revert on failure.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, packed: item.packed } : i)));
      alert('Could not update: ' + error.message);
    }
  }

  async function deleteItem(item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== item.id));
    const { error } = await supabase.from('equipment_items').delete().eq('id', item.id);
    if (error) {
      setItems(prev);
      alert('Could not delete: ' + error.message);
    }
  }

  const packedCount = items.filter((i) => i.packed).length;
  const totalCount = items.length;
  const progress = totalCount === 0 ? 0 : Math.round((packedCount / totalCount) * 100);

  return (
    <div className="animate-fade-in pb-6">
      {/* Header with progress */}
      <div className="card-warm mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Backpack className="w-5 h-5 text-coral-500" />
            <h2 className="font-display text-lg font-bold">Packing list</h2>
          </div>
          <span className="text-sm text-sage-600">
            {packedCount} / {totalCount} packed
          </span>
        </div>
        <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-teal transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Add item form */}
      <form onSubmit={addItem} className="flex gap-2 mb-5">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Add an item (e.g. Passport, Sunscreen)"
          className="input-field flex-1"
          disabled={adding}
        />
        <button
          type="submit"
          disabled={!newItemName.trim() || adding}
          className="btn-primary px-4 flex items-center justify-center"
          aria-label="Add item"
        >
          {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
        </button>
      </form>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-coral-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <Backpack className="w-12 h-12 text-sage-300 mx-auto mb-3" />
          <p className="text-sm text-sage-600">Your list is empty.</p>
          <p className="text-xs text-sage-500 mt-1">Add the first item to start packing.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 bg-surface-50 border border-surface-200 rounded-xl transition-all',
                item.packed && 'opacity-60'
              )}
            >
              <button
                type="button"
                onClick={() => togglePacked(item)}
                aria-label={item.packed ? `Mark ${item.name} as not packed` : `Mark ${item.name} as packed`}
                className={cn(
                  'w-6 h-6 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all',
                  item.packed
                    ? 'bg-teal-500 border-teal-500 text-white'
                    : 'border-sage-400 hover:border-coral-500'
                )}
              >
                {item.packed && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <span
                className={cn(
                  'flex-1 text-sm text-ink-900',
                  item.packed && 'line-through text-sage-500'
                )}
              >
                {item.name}
              </span>
              <button
                type="button"
                onClick={() => deleteItem(item)}
                className="p-1.5 text-sage-500 hover:text-coral-500 transition-colors"
                aria-label={`Delete ${item.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
