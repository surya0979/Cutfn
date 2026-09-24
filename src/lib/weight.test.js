import { describe, expect, it } from 'vitest'
import { yScale } from './chartScale.js'
import { DEFAULT_WEIGHT_KG, resolveBodyWeight, weeklyRateKg, weightAsOf, withMovingAverage } from './weight.js'

const w = (date, kg) => ({ id: date, date, kg })
const log = [w('2026-09-10', 82), w('2026-09-01', 84), w('2026-09-20', 80)]

describe('weightAsOf', () => {
  it('returns the latest weigh-in on or before the date', () => {
    expect(weightAsOf(log, '2026-09-15').kg).toBe(82)
    expect(weightAsOf(log, '2026-09-20').kg).toBe(80)
    expect(weightAsOf(log, '2026-12-01').kg).toBe(80)
  })

  it('falls back to the earliest weigh-in, then to a default', () => {
    expect(weightAsOf(log, '2026-08-01').kg).toBe(84)
    expect(weightAsOf([], '2026-08-01')).toBeNull()
    expect(resolveBodyWeight([], '2026-08-01')).toEqual({ kg: DEFAULT_WEIGHT_KG, date: null, isDefault: true })
  })
})

describe('trend', () => {
  it('averages the trailing 7 calendar days', () => {
    const points = withMovingAverage([w('2026-09-01', 80), w('2026-09-04', 82), w('2026-09-08', 78)])
    expect(points.map((p) => p.avgKg)).toEqual([80, 81, 80])
  })

  it('computes a weekly rate by least squares', () => {
    expect(weeklyRateKg(log)).toBeCloseTo(-1.472, 2)
    expect(weeklyRateKg([w('2026-09-01', 80)])).toBeNull()
  })
})

describe('chart y-scale', () => {
  it('uses evenly spaced nice ticks that contain the data', () => {
    const { domain, ticks } = yScale([179.4, 187.3], 'lb')
    const steps = new Set(ticks.slice(1).map((t, i) => +(t - ticks[i]).toFixed(3)))
    expect(steps.size).toBe(1)
    expect(domain[0]).toBeLessThanOrEqual(179.4)
    expect(domain[1]).toBeGreaterThanOrEqual(187.3)
    expect(ticks.length).toBeGreaterThanOrEqual(3)
    expect(ticks.length).toBeLessThanOrEqual(7)
  })

  it('handles a single weigh-in', () => {
    const { domain } = yScale([80, 80], 'kg')
    expect(domain[0]).toBeLessThan(80)
    expect(domain[1]).toBeGreaterThan(80)
  })
})
