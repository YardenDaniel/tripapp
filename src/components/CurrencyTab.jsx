import { useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';

const CURRENCIES = [
  { code: 'VND', name: 'Vietnamese Dong', flag: '🇻🇳' },
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
  { code: 'ILS', name: 'Israeli Shekel', flag: '🇮🇱' },
  { code: 'THB', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
];

const QUICK_AMOUNTS = [10000, 50000, 100000, 500000, 1000000];

export default function CurrencyTab({ trip }) {
  const [from, setFrom] = useState('VND');
  const [to, setTo] = useState('USD');
  const [amount, setAmount] = useState('100000');
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRates();
  }, []);

  async function loadRates() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) throw new Error('Failed to fetch rates');
      const data = await response.json();
      setRates(data.rates);
    } catch (err) {
      setError("Couldn't update rates. Check your internet.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function convert(value, fromCur, toCur) {
    if (!rates || !value) return 0;
    const inUSD = value / (rates[fromCur] || 1);
    return inUSD * (rates[toCur] || 1);
  }

  const result = convert(parseFloat(amount) || 0, from, to);
  const reverseRate = convert(1, to, from);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="card-warm ornamental-border">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-xl font-bold">Currency Converter</h2>
            <p className="text-xs text-gold-500/70 font-accent italic mt-1">
              Live exchange rates
            </p>
          </div>
          <button
            onClick={loadRates}
            disabled={loading}
            className="btn-ghost p-2"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-xs text-ivory-100/60 mb-1.5">From</label>
          <div className="flex gap-2">
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input-field max-w-[140px] py-2.5"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field flex-1 text-2xl font-mono py-2.5"
            />
          </div>
        </div>

        <div className="flex justify-center -my-1">
          <button
            onClick={swap}
            className="w-10 h-10 rounded-full bg-gradient-gold text-ink-900 shadow-gold hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
            aria-label="Swap"
          >
            <ArrowLeftRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-ivory-100/60 mb-1.5">To</label>
          <div className="flex gap-2">
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input-field max-w-[140px] py-2.5"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <div className="input-field flex-1 text-2xl font-mono py-2.5 flex items-center">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-gold-500" />
              ) : (
                <span className="text-gold-500">
                  {result.toLocaleString('en-US', { maximumFractionDigits: result < 100 ? 2 : 0 })}
                </span>
              )}
            </div>
          </div>
        </div>

        {rates && !loading && (
          <div className="mt-4 pt-4 border-t border-lacquer-900/30 flex items-center gap-2 text-xs text-ivory-100/60">
            <TrendingUp className="w-4 h-4 text-gold-500/60" />
            <span className="font-mono">
              1 {to} = {reverseRate.toLocaleString('en-US', { maximumFractionDigits: 4 })} {from}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-lacquer-900/40 border border-lacquer-700/40 rounded-lg text-xs text-lacquer-200">
            {error}
          </div>
        )}
      </div>

      {from === 'VND' && (
        <div className="card-warm">
          <h3 className="font-display font-semibold mb-3 text-gold-500">Common Amounts</h3>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(String(amt))}
                className="p-3 bg-ink-900/40 hover:bg-ink-800 border border-lacquer-900/30 hover:border-gold-500/30 rounded-xl transition-all text-left"
              >
                <div className="text-sm font-mono text-ivory-100">
                  ₫ {amt.toLocaleString()}
                </div>
                <div className="text-xs text-gold-500 font-mono mt-0.5">
                  ≈ ${convert(amt, 'VND', 'USD').toFixed(2)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card-warm bg-gradient-to-br from-gold-500/5 to-transparent">
        <h3 className="font-display font-semibold mb-2 text-gold-500">💡 Local Tip</h3>
        <p className="text-sm text-ivory-100/80 leading-relaxed">
          In Vietnam, dong banknotes are easy to confuse: 100,000 ₫ ≈ $4 USD. When someone says "100K", they mean 100,000 dong.
          Always ask to see the price written down before agreeing.
        </p>
      </div>
    </div>
  );
}
