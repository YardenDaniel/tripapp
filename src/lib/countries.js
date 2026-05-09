import countriesData from './countries.json';

// Aliases mapping legacy / alternative names → canonical "name" used in
// countries.json. Covers Hebrew names from older DB rows, common English
// short forms, and known typos. Add freely.
const ALIASES = {
  // Hebrew leftovers from older trips
  'ויאטנם': 'Vietnam',
  'תאילנד': 'Thailand',
  'יפן': 'Japan',
  'איטליה': 'Italy',
  'יוון': 'Greece',
  'פורטוגל': 'Portugal',
  'ישראל': 'Israel',
  'מצרים': 'Egypt',
  // Typos / informal
  'siani': 'Egypt',
  'sinai': 'Egypt',
  // Common English short forms
  'usa': 'United States',
  'us': 'United States',
  'united states of america': 'United States',
  'america': 'United States',
  'uk': 'United Kingdom',
  'britain': 'United Kingdom',
  'great britain': 'United Kingdom',
  'england': 'United Kingdom',
  'uae': 'United Arab Emirates',
  'south korea': 'South Korea',
  'korea': 'South Korea',
  'czech': 'Czech Republic',
  'czechia': 'Czech Republic',
  'holland': 'Netherlands',
  'macedonia': 'North Macedonia',
};

// Build a lowercase-name lookup once at module load.
const byName = new Map();
for (const c of countriesData) {
  byName.set(c.name.toLowerCase(), c);
}

// Default fallbacks for unknown countries.
const DEFAULT_MAP = { lat: 0, lng: 0, zoom: 2 };
const DEFAULT_CURRENCY = 'USD';

// Normalises a country name string to the canonical form used in countries.json.
// Returns the input unchanged if no alias matches.
export function normalizeCountryName(name) {
  if (!name) return name;
  const lower = name.toLowerCase().trim();
  return ALIASES[lower] || ALIASES[name] || name;
}

// Returns the country object for a given name, or null if not found.
// Lookup is case-insensitive and goes through the alias map first.
export function getCountry(name) {
  if (!name) return null;
  const normalized = normalizeCountryName(name);
  return byName.get(normalized.toLowerCase()) || null;
}

// Returns the full list of countries (sorted alphabetically as in the JSON).
export function getAllCountries() {
  return countriesData;
}

// Returns { lat, lng, zoom } for the country, or a sensible world default
// if the country isn't in our data.
export function getMapCenter(name) {
  const c = getCountry(name);
  return c ? c.map : DEFAULT_MAP;
}

// Returns the ISO 3166-1 alpha-2 code (e.g. "vn") used by Mapbox geocoding,
// or undefined if unknown. Returning undefined disables the country bias.
export function getISOCode(name) {
  return getCountry(name)?.code2;
}

// Returns the country's primary currency code (e.g. "VND"), or "USD" if unknown.
export function getDefaultCurrency(name) {
  return getCountry(name)?.currency?.code || DEFAULT_CURRENCY;
}

// Returns an array of default emergency contacts for the country.
// Shape: [{ name, number, type, description, is_default }]. Empty array if
// the country isn't in our data.
export function getEmergencyDefaults(name) {
  const c = getCountry(name);
  if (!c?.emergency) return [];
  const out = [];
  if (c.emergency.police) {
    out.push({ name: 'Police', number: c.emergency.police, type: 'police', description: null, is_default: true });
  }
  if (c.emergency.ambulance) {
    out.push({ name: 'Ambulance', number: c.emergency.ambulance, type: 'ambulance', description: null, is_default: true });
  }
  if (c.emergency.fire) {
    out.push({ name: 'Fire', number: c.emergency.fire, type: 'fire', description: null, is_default: true });
  }
  return out;
}
