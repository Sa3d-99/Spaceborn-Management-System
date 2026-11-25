const BUSINESS_TIME_ZONE = 'Asia/Kolkata';
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
});
const clockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', minute: '2-digit'
});

const businessDate = (instant = new Date()) => dateFormatter.format(instant);
const businessClock = instant => clockFormatter.format(instant);
function businessInstant(date, time) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(time || '');
  if (!match) return new Date(NaN);
  const [, hours, minutes, seconds = '00', period] = match;
  const hour = period ? Number(hours) % 12 + (period.toUpperCase() === 'PM' ? 12 : 0) : Number(hours);
  return new Date(`${date}T${String(hour).padStart(2, '0')}:${minutes}:${seconds}+05:30`);
}

module.exports = { BUSINESS_TIME_ZONE, businessDate, businessClock, businessInstant };
