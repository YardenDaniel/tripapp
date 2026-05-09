import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { getAllCountries, getDefaultCurrency } from '../lib/countries';

// Build the currency dropdown list from countries.json — one entry per
// distinct currency code. For currencies that span multiple countries (USD,
// EUR), the country-specific flag would be misleading (Ecuador's 🇪🇨 for USD
// because it's alphabetically first), so we force the canonical flag.
const FLAG_OVERRIDES = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
};

function buildCurrenciesList() {
  const seen = new Map();
  for (const c of getAllCountries()) {
    const code = c.currency?.code;
    if (!code || seen.has(code)) continue;
    seen.set(code, {
      code,
      name: c.currency.name,
      symbol: c.currency.symbol,
      flag: FLAG_OVERRIDES[code] || c.flag,
    });
  }
  if (!seen.has('USD')) {
    seen.set('USD', { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' });
  }
  if (!seen.has('EUR')) {
    seen.set('EUR', { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' });
  }
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
}

const CURRENCIES = buildCurrenciesList();
const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

// Returns 5 round amounts in `fromCurrency` that approximate $5, $20, $50,
// $200, $1000 USD. Adapts to any currency: gets bigger numbers for low-value
// units (VND, IDR), smaller numbers for high-value units.
function buildQuickAmounts(fromCurrency, rates) {
  if (!rates) return [];
  const fromRate = rates[fromCurrency] || 1; // rate from USD → fromCurrency
  return [5, 20, 50, 200, 1000].map((usd) => {
    const raw = usd * fromRate;
    if (raw >= 100000) return Math.round(raw / 10000) * 10000;
    if (raw >= 10000) return Math.round(raw / 1000) * 1000;
    if (raw >= 1000) return Math.round(raw / 100) * 100;
    if (raw >= 100) return Math.round(raw / 10) * 10;
    if (raw >= 10) return Math.round(raw);
    if (raw >= 1) return Math.round(raw * 10) / 10;
    return Math.round(raw * 100) / 100;
  });
}

export default function CurrencyTab({ trip }) {
  const tripCurrency = useMemo(() => getDefaultCurrency(trip.country), [trip.country]);
  const [from, setFrom] = useState(tripCurrency);
  // Default destination is USD, unless the trip's own currency IS USD —
  // then EUR makes a more useful default than a USD→USD identity conversion.
  const [to, setTo] = useState(() => (tripCurrency === 'USD' ? 'EUR' : 'USD'));
  const [amount, setAmount] = useState('100');
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
  const quickAmounts = useMemo(() => buildQuickAmounts(from, rates), [from, rates]);
  const fromMeta = CURRENCY_BY_CODE.get(from);
  const toMeta = CURRENCY_BY_CODE.get(to);

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
            <p className="text-xs text-coral-500/70 mt-1">
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
          <label className="block text-xs text-sage-600 mb-1.5">From</label>
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
            className="w-10 h-10 rounded-full bg-gradient-coral text-white shadow-coral hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
            aria-label="Swap"
          >
            <ArrowLeftRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-sage-600 mb-1.5">To</label>
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
                <Loader2 className="w-5 h-5 animate-spin text-coral-500" />
              ) : (
                <span className="text-coral-500">
                  {result.toLocaleString('en-US', { maximumFractionDigits: result < 100 ? 2 : 0 })}
                </span>
              )}
            </div>
          </div>
        </div>

        {rates && !loading && (
          <div className="mt-4 pt-4 border-t border-surface-200 flex items-center gap-2 text-xs text-sage-600">
            <TrendingUp className="w-4 h-4 text-coral-500/60" />
            <span className="font-mono">
              1 {to} = {reverseRate.toLocaleString('en-US', { maximumFractionDigits: 4 })} {from}
            </span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-coral-100 border border-coral-300 rounded-lg text-xs text-coral-700">
            {error}
          </div>
        )}
      </div>

      {quickAmounts.length > 0 && (
        <div className="card-warm">
          <h3 className="font-display font-semibold mb-3 text-coral-500">Common Amounts</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(String(amt))}
                className="p-3 bg-surface-100 hover:bg-surface-200 border border-surface-200 hover:border-coral-500/40 rounded-xl transition-all text-left"
              >
                <div className="text-sm font-mono text-ink-900">
                  {fromMeta?.symbol || ''} {amt.toLocaleString()}
                </div>
                <div className="text-xs text-coral-500 font-mono mt-0.5">
                  ≈ {toMeta?.symbol || ''}
                  {convert(amt, from, to).toLocaleString('en-US', {
                    maximumFractionDigits: 2,
                  })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
