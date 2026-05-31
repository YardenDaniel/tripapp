import { useEffect, useMemo, useState } from 'react';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Loader2, Sun, RefreshCw, Wind, Droplets } from 'lucide-react';
import { getMapCenter, getCountry } from '../lib/countries';
import { cn } from '../lib/utils';

// Open-Meteo: free, no API key. https://open-meteo.com
// Returns daily forecast (max 16 days). We request enough to cover trip dates.
const FORECAST_DAYS = 14;

// Map WMO weather codes (https://open-meteo.com/en/docs#api_form) to icon + label.
const WMO = {
  0:  { icon: Sun,           label: 'Clear sky',          tone: 'text-amber-500' },
  1:  { icon: Sun,           label: 'Mostly clear',       tone: 'text-amber-500' },
  2:  { icon: Cloud,         label: 'Partly cloudy',      tone: 'text-sage-500' },
  3:  { icon: Cloud,         label: 'Overcast',           tone: 'text-sage-600' },
  45: { icon: CloudFog,      label: 'Fog',                tone: 'text-sage-500' },
  48: { icon: CloudFog,      label: 'Rime fog',           tone: 'text-sage-500' },
  51: { icon: CloudDrizzle,  label: 'Light drizzle',      tone: 'text-teal-600' },
  53: { icon: CloudDrizzle,  label: 'Drizzle',            tone: 'text-teal-600' },
  55: { icon: CloudDrizzle,  label: 'Heavy drizzle',      tone: 'text-teal-700' },
  61: { icon: CloudRain,     label: 'Light rain',         tone: 'text-teal-600' },
  63: { icon: CloudRain,     label: 'Rain',               tone: 'text-teal-700' },
  65: { icon: CloudRain,     label: 'Heavy rain',         tone: 'text-teal-800' },
  71: { icon: CloudSnow,     label: 'Light snow',         tone: 'text-sky-400' },
  73: { icon: CloudSnow,     label: 'Snow',               tone: 'text-sky-500' },
  75: { icon: CloudSnow,     label: 'Heavy snow',         tone: 'text-sky-600' },
  77: { icon: CloudSnow,     label: 'Snow grains',        tone: 'text-sky-400' },
  80: { icon: CloudRain,     label: 'Showers',            tone: 'text-teal-600' },
  81: { icon: CloudRain,     label: 'Heavy showers',      tone: 'text-teal-700' },
  82: { icon: CloudRain,     label: 'Violent showers',    tone: 'text-teal-800' },
  85: { icon: CloudSnow,     label: 'Snow showers',       tone: 'text-sky-500' },
  86: { icon: CloudSnow,     label: 'Heavy snow showers', tone: 'text-sky-600' },
  95: { icon: CloudLightning, label: 'Thunderstorm',      tone: 'text-coral-600' },
  96: { icon: CloudLightning, label: 'Thunder + hail',    tone: 'text-coral-700' },
  99: { icon: CloudLightning, label: 'Thunder + heavy hail', tone: 'text-coral-700' },
};

function describeCode(code) {
  return WMO[code] || { icon: Cloud, label: 'Unknown', tone: 'text-sage-500' };
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diffDays = Math.round((that - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function WeatherTab({ trip }) {
  const center = useMemo(() => getMapCenter(trip.country), [trip.country]);
  const countryMeta = useMemo(() => getCountry(trip.country), [trip.country]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.country]);

  async function loadForecast() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        latitude: String(center.lat),
        longitude: String(center.lng),
        timezone: 'auto',
        forecast_days: String(FORECAST_DAYS),
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
      });
      const url = `https://api.open-meteo.com/v1/forecast?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather API returned ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Could not load weather');
    } finally {
      setLoading(false);
    }
  }

  const tripDays = useMemo(() => {
    if (!data?.daily?.time) return [];
    const days = data.daily.time.map((t, i) => ({
      date: t,
      code: data.daily.weather_code[i],
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
      precip: data.daily.precipitation_sum[i],
      precipProb: data.daily.precipitation_probability_max?.[i],
      wind: data.daily.wind_speed_10m_max?.[i],
    }));
    // Show: trip dates that fall inside the forecast window. If the trip is
    // far in the future and has no overlap, show next 7 days as a fallback.
    const tripStart = new Date(trip.start_date);
    const tripEnd = new Date(trip.end_date);
    const inTrip = days.filter((d) => {
      const dt = new Date(d.date);
      return dt >= tripStart && dt <= tripEnd;
    });
    return inTrip.length > 0 ? inTrip : days.slice(0, 7);
  }, [data, trip.start_date, trip.end_date]);

  const tripStartDate = new Date(trip.start_date);
  const isTripFarFuture = tripStartDate.getTime() > Date.now() + FORECAST_DAYS * 86400000;

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-coral-500" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card-warm text-center py-8">
        <p className="text-sm text-coral-700 mb-3">{error}</p>
        <button onClick={loadForecast} className="btn-primary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  const current = data?.current;
  const currentDescription = current ? describeCode(current.weather_code) : null;
  const CurrentIcon = currentDescription?.icon;

  return (
    <div className="animate-fade-in space-y-4 pb-6">
      {/* Now-card */}
      <div className="card-warm ornamental-border">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-coral-500/80">Right now in</p>
            <h2 className="font-display text-xl font-bold">
              {countryMeta?.flag ? `${countryMeta.flag} ` : ''}
              {countryMeta?.capital || trip.country}
            </h2>
          </div>
          <button
            onClick={loadForecast}
            disabled={loading}
            className="btn-ghost p-2"
            aria-label="Refresh weather"
            title="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {current && (
          <div className="flex items-center gap-4">
            {CurrentIcon && (
              <CurrentIcon className={cn('w-16 h-16', currentDescription.tone)} />
            )}
            <div className="flex-1">
              <p className="font-display text-4xl font-bold text-ink-900 leading-none">
                {Math.round(current.temperature_2m)}°
              </p>
              <p className="text-sm text-sage-600 mt-1">{currentDescription.label}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-sage-600">
                <span className="flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5" />
                  {current.relative_humidity_2m}%
                </span>
                <span className="flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5" />
                  {Math.round(current.wind_speed_10m)} km/h
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Daily forecast for the trip dates */}
      <div>
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h3 className="font-display text-sm font-semibold text-ink-900">
            {tripDays.length > 0 && tripDays[0].date >= trip.start_date
              ? `Forecast for your trip`
              : 'Next 7 days'}
          </h3>
          {isTripFarFuture && (
            <span className="text-xs text-sage-500">Trip is too far out — showing next week</span>
          )}
        </div>

        {tripDays.length === 0 ? (
          <div className="card-warm text-center py-6 text-sm text-sage-500">
            No forecast available for this trip's dates.
          </div>
        ) : (
          <ul className="space-y-2">
            {tripDays.map((d) => {
              const desc = describeCode(d.code);
              const Icon = desc.icon;
              return (
                <li key={d.date} className="card-warm py-3">
                  <div className="flex items-center gap-3">
                    <Icon className={cn('w-9 h-9 flex-shrink-0', desc.tone)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium text-ink-900 text-sm">
                          {formatDayLabel(d.date)}
                        </p>
                        <p className="font-mono text-sm text-ink-900 whitespace-nowrap">
                          <span className="font-bold">{Math.round(d.max)}°</span>
                          <span className="text-sage-500"> / {Math.round(d.min)}°</span>
                        </p>
                      </div>
                      <p className="text-xs text-sage-600 mt-0.5">{desc.label}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-sage-500">
                        {d.precip > 0 && (
                          <span className="flex items-center gap-1">
                            <Droplets className="w-3 h-3 text-teal-500" />
                            {d.precip.toFixed(1)} mm
                            {d.precipProb != null && <span className="text-sage-400">({d.precipProb}%)</span>}
                          </span>
                        )}
                        {d.wind != null && (
                          <span className="flex items-center gap-1">
                            <Wind className="w-3 h-3" />
                            {Math.round(d.wind)} km/h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-[10px] text-sage-400 text-center pt-2">
        Forecast for {countryMeta?.name || trip.country} ({center.lat.toFixed(2)}, {center.lng.toFixed(2)}) · Powered by Open-Meteo
      </p>
    </div>
  );
}
