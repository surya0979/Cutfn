// Calendar days as local 'YYYY-MM-DD' strings, so "today" matches the wall clock.

const pad = (n) => String(n).padStart(2, '0')

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayKey = () => toKey(new Date())

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key, n) {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** Whole days from a to b (b later = positive). */
export function daysBetween(a, b) {
  return Math.round((parseKey(b) - parseKey(a)) / 86_400_000)
}

export function formatDay(key, today = todayKey()) {
  if (key === today) return 'Today'
  if (key === addDays(today, -1)) return 'Yesterday'
  const d = parseKey(key)
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function relativeDays(key, today = todayKey()) {
  if (!key) return 'never'
  const n = daysBetween(key, today)
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n < 30) return `${n} days ago`
  if (n < 60) return 'a month ago'
  return `${Math.round(n / 30)} months ago`
}
