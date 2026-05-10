import { useEffect, useState, useRef } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { getCountry } from '../lib/countries';

export default function ChatTab({ trip }) {
  return <ChatInterface trip={trip} />;
}

function ChatInterface({ trip }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // Scroll the inner chat list directly instead of using scrollIntoView,
  // which can scroll the page (not just the list) and shift the cover above.
  const listRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, [trip.id]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (messages.length === 0) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at');

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setInput('');
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { data: savedUser } = await supabase
      .from('chat_messages')
      .insert({ trip_id: trip.id, user_id: user.id, role: 'user', content: userMsg })
      .select()
      .single();

    if (savedUser) setMessages((prev) => [...prev, savedUser]);

    const tripContext = `The trip is "${trip.name}" in ${trip.country}. Dates: ${trip.start_date} to ${trip.end_date}.`;
    const conversationHistory = messages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `You are a personal travel assistant. ${tripContext}

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n` : ''}

New question: ${userMsg}

Respond in English, concisely (up to 4 sentences when possible), in a friendly and warm tone. If the user asks about a specific place, restaurant, or attraction, answer in a focused way. When relevant, end with a suggestion: "Want me to add this to your itinerary?"`;

    try {
      // Calls the Supabase Edge Function 'chat' which holds the Anthropic key
      // server-side. The user's auth JWT is attached automatically.
      const { data, error: fnError } = await supabase.functions.invoke('chat', {
        body: { prompt },
      });

      if (fnError) throw new Error(fnError.message || 'AI error');
      if (data?.error) throw new Error(data.error);

      const aiContent = data?.text || "Sorry, I couldn't understand. Could you try again?";

      const { data: savedAi } = await supabase
        .from('chat_messages')
        .insert({ trip_id: trip.id, user_id: user.id, role: 'assistant', content: aiContent })
        .select()
        .single();

      if (savedAi) setMessages((prev) => [...prev, savedAi]);
    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: `Sorry, there's an issue connecting to the AI. Please try again in a moment.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  // Templated starter prompts using the trip's country / capital.
  // Falls back to country name if the country isn't in our data file.
  const countryMeta = getCountry(trip.country);
  const place = countryMeta?.capital || trip.country;
  const countryName = countryMeta?.name || trip.country;
  const suggestions = [
    `What should I eat in ${place}?`,
    `Must-see attractions in ${countryName}`,
    `Tips for getting around in ${countryName}`,
    `Local etiquette and customs in ${countryName}`,
  ];

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-coral-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-coral flex items-center justify-center shadow-coral">
              <Sparkles className="w-8 h-8 text-ink-900" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2">Your Smart Assistant</h3>
            <p className="text-sm text-sage-600 max-w-xs mx-auto leading-relaxed mb-6">
              Ask me anything about your trip - restaurants, transport, attractions, or local tips.
            </p>
            <div className="space-y-2 max-w-sm mx-auto">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full text-left px-4 py-2.5 bg-surface-100 border border-surface-200 rounded-xl text-sm text-sage-700 hover:border-coral-500/40 hover:bg-surface-200 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {sending && (
          <div className="flex items-center gap-2 text-coral-500/60 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="italic">Thinking...</span>
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t border-surface-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          className="input-field flex-1"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary px-4"
          aria-label="Send"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex animate-fade-in', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-gradient-teal text-white rounded-br-md'
            : 'bg-surface-50 text-ink-900 border border-surface-200 rounded-bl-md'
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 text-coral-500 text-xs">
            <Sparkles className="w-3 h-3" />
            <span>Assistant</span>
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
