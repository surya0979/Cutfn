// Dates are stored as local calendar keys ("YYYY-MM-DD"), never as UTC ISO
// strings, so a meal logged at 11pm doesn't land on tomorrow.

const pad = (n) => String(n).padStart(2, '0')

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Parse a date key at local noon so DST shifts can never change the day. */
export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(key, days) {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function daysBetween(fromKey, toKey) {
  return Math.round((fromDateKey(toKey) - fromDateKey(fromKey)) / 86_400_000)
}

export function formatDay(key, today = toDateKey()) {
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatShortDate(key) {
  return fromDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
