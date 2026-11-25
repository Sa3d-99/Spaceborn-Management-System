export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';
let displayTimeZone = BUSINESS_TIME_ZONE;

export function setDisplayTimeZone(timeZone) {
  displayTimeZone = timeZone || BUSINESS_TIME_ZONE;
}

export function businessDate(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(instant);
}

export function displayDate(value, locales = 'en-IN', options = {}) {
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(value).toLocaleDateString(locales, { timeZone: dateOnly ? 'UTC' : displayTimeZone, ...options });
}

export function displayDateTime(value, locales = 'en-IN', options = {}) {
  return new Date(value).toLocaleString(locales, { timeZone: displayTimeZone, ...options });
}

export function displayTime(value, locales = 'en-IN', options = {}) {
  return new Date(value).toLocaleTimeString(locales, { timeZone: displayTimeZone, ...options });
}

export function meetingTime(date, time) {
  const parsed = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i.exec(time || '');
  if (!parsed) return `${displayDate(date)} ${time || ''}`;
  const [, hours, minutes, period] = parsed;
  const hour = period ? Number(hours) % 12 + (period.toLowerCase() === 'pm' ? 12 : 0) : Number(hours);
  const instant = new Date(`${date}T${String(hour).padStart(2, '0')}:${minutes}:00+05:30`);
  if (Number.isNaN(instant.getTime())) return `${displayDate(date)} ${time}`;
  return displayDateTime(instant, 'en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });
}
