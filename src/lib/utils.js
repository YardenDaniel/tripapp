import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date, options = {}) {
  return new Date(date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  });
}

export function formatTime(time) {
  if (!time) return '';
  return time.slice(0, 5);
}

export function formatCurrency(amount, currency = 'VND') {
  if (!amount && amount !== 0) return '';
  const formatters = {
    VND: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }),
    ILS: new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }),
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  };
  return (formatters[currency] || formatters.USD).format(amount);
}

export function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate - startDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
}

export function generateDayDates(startDate, endDate) {
  const days = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  let dayNumber = 1;

  while (current <= end) {
    days.push({
      date: current.toISOString().split('T')[0],
      day_number: dayNumber,
    });
    current.setDate(current.getDate() + 1);
    dayNumber++;
  }
  return days;
}

export const ACTIVITY_TYPES = {
  food: { label: 'Food', icon: '🍜', color: 'bg-amber-500/20 text-amber-200' },
  lodging: { label: 'Lodging', icon: '🏨', color: 'bg-purple-500/20 text-purple-200' },
  attraction: { label: 'Attraction', icon: '🏛️', color: 'bg-sage-500/20 text-sage-200' },
  transport: { label: 'Transport', icon: '🚌', color: 'bg-blue-500/20 text-blue-200' },
  other: { label: 'Other', icon: '📍', color: 'bg-cream-50/10 text-cream-100' },
};

export const EMERGENCY_TYPE_ICONS = {
  police: '👮',
  ambulance: '🚑',
  fire: '🚒',
  embassy: '🏛️',
  insurance: '🛡️',
  other: '📞',
};
