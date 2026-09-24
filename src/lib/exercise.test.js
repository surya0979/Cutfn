import { describe, expect, it } from 'vitest'
import {
  distanceBurn,
  exerciseBurn,
  formatPace,
  interpolateMet,
  jumpRopeBurn,
  kcalFromMet,
  RUNNING_METS,
  WALKING_METS,
} from './exercise.js'
import { lbToKg, miToKm } from './units.js'

describe('MET equation', () => {
  it('is MET × kg × hours', () => {
    expect(kcalFromMet(10, 80, 60)).toBe(800)
    expect(kcalFromMet(3.5, 70, 30)).toBeCloseTo(122.5)
  })

  it('interpolates between Compendium rows and clamps at the ends', () => {
    expect(interpolateMet(RUNNING_METS, 6)).toBe(9.8)
    expect(interpolateMet(RUNNING_METS, 5.6)).toBeCloseTo(9.4)
    expect(interpolateMet(RUNNING_METS, 2)).toBe(6.0)
    expect(interpolateMet(RUNNING_METS, 30)).toBe(23.0)
    expect(interpolateMet(WALKING_METS, 3)).toBe(3.5)
  })
})

describe('distance to calories', () => {
  const kg = lbToKg(180)

  it('assumes a 10:00 /mi pace for a run without a time', () => {
    const r = distanceBurn({ activity: 'run', distanceKm: miToKm(3), weightKg: kg })
    expect(r.assumedPace).toBe(true)
    expect(r.minutes).toBeCloseTo(30)
    expect(r.met).toBe(9.8)
    // ~0.74 kcal per lb per mile, the usual running rule of thumb
    expect(r.kcal).toBeCloseTo(9.8 * kg * 0.5)
    expect(r.kcal / 3 / 180).toBeGreaterThan(0.65)
    expect(r.kcal / 3 / 180).toBeLessThan(0.85)
  })

  it('uses the actual speed when a time is given', () => {
    const r = distanceBurn({ activity: 'run', distanceKm: miToKm(3), durationMin: 24, weightKg: kg })
    expect(r.speedMph).toBeCloseTo(7.5)
    expect(r.met).toBe(11.5)
    expect(r.kcal).toBeCloseTo(11.5 * kg * 0.4)
  })

  it('walking burns less than running over the same distance', () => {
    const walk = distanceBurn({ activity: 'walk', distanceKm: 5, weightKg: kg })
    const run = distanceBurn({ activity: 'run', distanceKm: 5, weightKg: kg })
    expect(walk.kcal).toBeLessThan(run.kcal)
  })

  it('scales linearly with body weight', () => {
    const light = distanceBurn({ activity: 'walk', distanceKm: 4, weightKg: 60 })
    const heavy = distanceBurn({ activity: 'walk', distanceKm: 4, weightKg: 90 })
    expect(heavy.kcal / light.kcal).toBeCloseTo(1.5)
  })

  it('flags implausible paces and rejects empty input', () => {
    expect(distanceBurn({ activity: 'walk', distanceKm: miToKm(10), durationMin: 30, weightKg: kg }).outOfRange).toBe(true)
    expect(distanceBurn({ activity: 'run', distanceKm: 0, weightKg: kg })).toBeNull()
  })
})

describe('jump rope', () => {
  it('converts skips to minutes at 110/min and uses 11.8 METs', () => {
    const r = jumpRopeBurn({ mode: 'skips', skips: 1100, weightKg: 80 })
    expect(r.minutes).toBeCloseTo(10)
    expect(r.met).toBe(11.8)
    expect(r.kcal).toBeCloseTo((11.8 * 80 * 10) / 60)
  })

  it('accepts minutes directly and estimates the skip count', () => {
    const r = jumpRopeBurn({ mode: 'minutes', minutes: 15, intensity: 'fast', weightKg: 70 })
    expect(r.met).toBe(12.3)
    expect(r.skips).toBe(2100)
  })

  it('recomputes stored entries against a new weight', () => {
    const entry = { kind: 'jumprope', mode: 'minutes', minutes: 10, intensity: 'moderate' }
    expect(exerciseBurn(entry, 90).kcal).toBeGreaterThan(exerciseBurn(entry, 70).kcal)
  })
})

it('formats pace per mile and per km', () => {
  expect(formatPace(6)).toBe('10:00 /mi')
  expect(formatPace(6, 'km')).toBe('6:13 /km')
})
