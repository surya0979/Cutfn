export const DAY = 86_400_000

/** Evenly spaced whole-day ticks across the visible range. */
export function dayTicks(min, max) {
  const days = Math.round((max - min) / DAY)
  const count = Math.min(6, days + 1)
  if (count <= 1) return [min]
  const step = Math.ceil(days / (count - 1))
  const ticks = []
  for (let t = min; t <= max + 1; t += step * DAY) ticks.push(t)
  return ticks
}

/**
 * Y range hugging the data with a little headroom, snapped to an even "nice"
 * step, so the chart re-zooms as the cut progresses and small drops stay visible.
 */
export function yScale(values, unit) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.12, unit === 'lb' ? 1 : 0.5)
  const lo = min - pad
  const hi = max + pad
  const step = [0.5, 1, 2, 5, 10, 20, 50].find((s) => Math.ceil(hi / s) - Math.floor(lo / s) <= 6) ?? 100
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const ticks = []
  for (let t = start; t <= end + step / 2; t += step) ticks.push(Math.round(t * 10) / 10)
  return { domain: [start, end], ticks }
}
