export const MADRID = 'Europe/Madrid';

export function isBookingEndpoint(url: string): boolean {
  return /^\/(?:public\/trial-bookings|public\/bookings|admin\/booking-requests|admin\/bookings|admin\/classes|bookings|classes)(?:\/|\?|$)/.test(url);
}

// Calendar dates are represented in the browser's local calendar, not as instants.
export function shiftCalendarPeriod(date: Date, view: 'week' | 'month' | 'year', direction: number): Date {
  const result = new Date(date);
  if (view === 'week') {
    result.setDate(result.getDate() + direction * 7);
    return result;
  }
  const day = result.getDate();
  result.setDate(1);
  if (view === 'month') result.setMonth(result.getMonth() + direction);
  else result.setFullYear(result.getFullYear() + direction);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}
const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: MADRID, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function madridInput(value: string | Date): string {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function madridToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Introduce una fecha y hora válidas en horario peninsular.');
  const naive = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0, 16) !== value) throw new Error('Introduce una fecha y hora válidas en horario peninsular.');
  const matches = [1, 2].map(offset => new Date(naive - offset * 3600000)).filter(date => madridInput(date) === value);
  if (!matches.length) throw new Error('Esta hora no existe en la España peninsular por el cambio de hora.');
  if (matches.length > 1) throw new Error('Esta hora es ambigua en la España peninsular por el cambio de hora; elige otra hora.');
  return matches[0]!.toISOString();
}
// This Date represents a civil calendar day, not an instant.
export function madridCalendarDate(value: string | Date = new Date()): Date {
  const [year, month, day] = madridInput(value).slice(0, 10).split('-').map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

// The API treats offset-less database datetimes as UTC (see backend aware()).
export function utcApiTimestamp(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value) ? `${value}Z` : value;
}

export function normalizeBookingTimes<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalizeBookingTimes) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      (key === 'starts_at' || key === 'ends_at') && typeof item === 'string'
        ? utcApiTimestamp(item) : normalizeBookingTimes(item),
    ])) as T;
  }
  return value;
}

// Dates here represent Madrid civil days, not instants.
export function mondayStart(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - (result.getDay() + 6) % 7);
  return result;
}
export function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}
export function canCancelBooking(status: string, startsAt: string, now = Date.now()): boolean {
  return status === 'requested' || (status === 'confirmed' && new Date(startsAt).getTime() - now > 24 * 60 * 60 * 1000);
}

/** A class must finish on its starting Madrid date by 21:00 inclusive. */
export function classEndsByMadridCutoff(starts: Date, durationSlots: number): boolean {
  const start = madridInput(starts)
  const end = madridInput(new Date(starts.getTime() + durationSlots * 30 * 60 * 1000))
  return end.slice(0, 10) === start.slice(0, 10) && end.slice(11) <= "21:00"
}
