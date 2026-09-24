import { daysBetween } from './dates.js'

/** Used for burn estimates until the first weigh-in is logged (~154 lb). */
export const DEFAULT_WEIGHT_KG = 70

export const sortByDate = (entries) => [...entries].sort((a, b) => a.date.localeCompare(b.date))

/**
 * Body weight to use for anything that happened on `dateKey`: the most recent
 * weigh-in on or before that day. If the day predates every weigh-in, the
 * earliest weigh-in is the best guess. Returns null when nothing is logged.
 */
export function weightAsOf(weights, dateKey) {
  if (!weights.length) return null
  const sorted = sortByDate(weights)
  let match = null
  for (const entry of sorted) {
    if (entry.date > dateKey) break
    match = entry
  }
  return match ?? sorted[0]
}

/** Weight (kg) plus where it came from, for display next to burn estimates. */
export function resolveBodyWeight(weights, dateKey) {
  const entry = weightAsOf(weights, dateKey)
  return entry
    ? { kg: entry.kg, date: entry.date, isDefault: false }
    : { kg: DEFAULT_WEIGHT_KG, date: null, isDefault: true }
}

/** Trailing average over the `windowDays` calendar days ending on each weigh-in. */
export function withMovingAverage(weights, windowDays = 7) {
  const sorted = sortByDate(weights)
  return sorted.map((entry, i) => {
    let sum = 0
    let count = 0
    for (let j = i; j >= 0 && daysBetween(sorted[j].date, entry.date) < windowDays; j--) {
      sum += sorted[j].kg
      count++
    }
    return { ...entry, avgKg: sum / count }
  })
}

/** Least-squares slope in kg per week; null with fewer than two distinct days. */
export function weeklyRateKg(weights) {
  if (weights.length < 2) return null
  const sorted = sortByDate(weights)
  const xs = sorted.map((e) => daysBetween(sorted[0].date, e.date))
  const ys = sorted.map((e) => e.kg)
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  return den === 0 ? null : (num / den) * 7
}
