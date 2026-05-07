import { useEffect, useState, useRef } from 'react';
import { Send, Sparkles, Loader2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

const HAS_API_KEY = !!import.meta.env.VITE_ANTHROPIC_API_KEY;

export default function ChatTab({ trip }) {
  if (!HAS_API_KEY) {
    return <ComingSoonScreen />;
  }
  return <ChatInterface trip={trip} />;
}

function ComingSoonScreen() {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center min-h-[400px] text-center px-4">
      <div className="w-20 h-20 rounded-full bg-gradient-coral flex items-center justify-center shadow-coral mb-6 relative">
        <Sparkles className="w-10 h-10 text-ink-900" />
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-ink-900 border-2 border-coral-500 flex items-center justify-center">
          <Lock className="w-3.5 h-3.5 text-coral-500" />
        </div>
      </div>

      <h3 className="font-display text-2xl font-bold mb-3">Smart Assistant Coming Soon</h3>

      <p className="text-sm text-cream-100/70 max-w-sm leading-relaxed mb-6">
        Your AI travel assistant will recommend restaurants, attractions, hidden gems, and help you plan in real time.
      </p>

      <div className="card-warm max-w-sm w-full text-left">
        <h4 className="font-display font-semibold text-coral-500 mb-2 text-sm">
          ✨ What it will do
        </h4>
        <ul className="space-y-2 text-xs text-cream-100/70">
          <li className="flex items-start gap-2">
            <span className="text-coral-500 mt-0.5">•</span>
            <span>Recommend restaurants based on your current location</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coral-500 mt-0.5">•</span>
            <span>Answer questions about culture, customs, and local tips</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coral-500 mt-0.5">•</span>
            <span>Add recommendations directly to your itinerary</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coral-500 mt-0.5">•</span>
            <span>Remember your trip context - where you've been, what you've seen</span>
          </li>
        </ul>
      </div>

      <p className="text-xs text-cream-100/40 mt-6">
        Will activate automatically when API key is added
      </p>
    </div>
  );
}

function ChatInterface({ trip }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, [trip.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'AI error');
      }

      const result = await response.json();
      const aiContent = result.content?.[0]?.text || "Sorry, I couldn't understand. Could you try again?";

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
        content: `Sorry, there's an issue connecting to the AI. ${err.message?.includes('API key') ? 'Looks like the API key is missing.' : 'Please try again in a moment.'}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  const suggestions = [
    'What should I eat in Hanoi?',
    'How do I get from Hanoi to Ha Long Bay?',
    'Must-see attractions in Northern Vietnam',
    'Good pho restaurants nearby',
  ];

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
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
            <p className="text-sm text-cream-100/60 max-w-xs mx-auto leading-relaxed mb-6">
              Ask me anything about your trip - restaurants, transport, attractions, or local tips.
            </p>
            <div className="space-y-2 max-w-sm mx-auto">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full text-left px-4 py-2.5 bg-ink-800/40 border border-teal-900/30 rounded-xl text-sm text-cream-100/80 hover:border-coral-500/30 transition-all"
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
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 pt-3 border-t border-teal-900/30">
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
            ? 'bg-gradient-teal text-cream-50 rounded-br-md'
            : 'bg-ink-800/80 text-cream-100 border border-coral-500/20 rounded-bl-md'
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
