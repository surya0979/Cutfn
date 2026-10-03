import { describe, expect, it } from 'vitest'
import { addDays } from './dates.js'
import { MIN_TARGET, smartTarget, dailyTotals, guardrails } from './insights.js'
import { defaultLimit, effectiveTarget, planState } from './plan.js'

const start = '2026-09-01'
const cut = { mode: 'cut', startDate: start, startKcal: 2200, step: 50, limit: 1900 }
const bulk = { mode: 'bulk', startDate: start, startKcal: 2500, step: 100, limit: 2800 }

/** Weigh-ins every other day from `from` to `to`, changing `pctPerWeek` % a week. */
function weighIns(from, to, startKg, pctPerWeek) {
  const out = []
  for (let d = from, i = 0; d <= to; d = addDays(d, 2), i += 2) out.push({ date: d, kg: startKg * (1 + (pctPerWeek / 100) * (i / 7)) })
  return out
}

describe('cut plan', () => {
  it('drops the max one step per week', () => {
    expect(planState(cut, start).kcal).toBe(2200)
    expect(planState(cut, addDays(start, 6)).kcal).toBe(2200)
    expect(planState(cut, addDays(start, 7))).toMatchObject({ kcal: 2150, week: 2, nextKcal: 2100, nextDate: addDays(start, 14) })
    expect(planState(cut, addDays(start, 21)).kcal).toBe(2050)
  })

  it('stops at the floor and never below 1,800', () => {
    const s = planState(cut, addDays(start, 70))
    expect(s.kcal).toBe(1900)
    expect(s.atLimit).toBe(true)
    expect(planState({ ...cut, limit: 1500 }, addDays(start, 300)).kcal).toBe(MIN_TARGET)
  })

  it('skips a drop when weight is already falling fast', () => {
    const weights = weighIns(addDays(start, -14), addDays(start, 21), 80, -1.2)
    const s = planState(cut, addDays(start, 14), weights)
    expect(s.history.map((h) => h.status)).toEqual(['held', 'held'])
    expect(s.kcal).toBe(2200)
    const steady = planState(cut, addDays(start, 14), weighIns(addDays(start, -14), addDays(start, 21), 80, -0.5))
    expect(steady.kcal).toBe(2100)
  })
})

describe('bulk plan', () => {
  it('raises the goal each week up to the ceiling', () => {
    expect(planState(bulk, addDays(start, 7)).kcal).toBe(2600)
    expect(planState(bulk, addDays(start, 70))).toMatchObject({ kcal: 2800, atLimit: true })
  })

  it('pauses increases while gaining fast', () => {
    const weights = weighIns(addDays(start, -14), addDays(start, 14), 70, 0.9)
    expect(planState(bulk, addDays(start, 7), weights).history[0].status).toBe('held')
  })

  it('has sensible default limits', () => {
    expect(defaultLimit('bulk', 2500)).toBe(3000)
    expect(defaultLimit('cut', 2100)).toBe(MIN_TARGET)
    expect(defaultLimit('cut', 2600)).toBe(2200)
  })
})

it('uses the fixed max when no plan runs', () => {
  expect(effectiveTarget({ targetKcal: 2200, plan: null }, start, [])).toBe(2200)
  expect(effectiveTarget({ targetKcal: 2200, plan: cut }, addDays(start, 7), [])).toBe(2150)
})

describe('bulk-aware insights', () => {
  const today = '2026-09-24'
  const meals = []
  for (let i = 21; i >= 1; i--) {
    const d = addDays(today, -i)
    meals.push({ date: d, kcal: 1300, createdAt: 0 }, { date: d, kcal: 1300, createdAt: 1 })
  }
  const weights = weighIns(addDays(today, -21), addDays(today, -1), 70, 0.3)
  const days = dailyTotals({ meals, exercises: [], weights, from: addDays(today, -42), to: today })

  it('suggests a surplus on a bulk', () => {
    const t = smartTarget({ days, weights, today, mode: 'bulk' })
    expect(t.suggested).toBeGreaterThan(t.maintenance)
    expect(t.suggested - t.maintenance).toBeLessThanOrEqual(350)
  })

  it('warns about fast gain only on a bulk', () => {
    const fast = weighIns(addDays(today, -21), addDays(today, -1), 70, 1.4)
    expect(guardrails({ days, weights: fast, today, targetKcal: 2600, mode: 'bulk' }).map((w) => w.id)).toContain('fast-gain')
    expect(guardrails({ days, weights: fast, today, targetKcal: 2600, mode: 'cut' }).map((w) => w.id)).not.toContain('fast-gain')
  })
})
