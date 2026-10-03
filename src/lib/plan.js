// Cut and bulk plans: the daily calorie number moves a small step each week.
//
// Cut  – the daily MAX drops by `step` every 7 days, never below `limit`
//        (at least 1,800 kcal). A drop is skipped when the last two weeks
//        already show fast loss (> 0.75% of body weight a week).
// Bulk – the daily GOAL rises by `step` every 7 days, up to `limit`.
//        A rise is skipped when the last two weeks show fast gain
//        (> 0.5% of body weight a week), to keep the bulk lean.
//
// The number for any day is worked out from the plan and the weigh-ins, so
// it is the same on every device and nothing extra needs saving each week.

import { addDays, daysBetween } from './dates.js'
import { MIN_TARGET } from './insights.js'
import { sortByDate, weeklyRateKg } from './weight.js'

export const PLAN_MODES = {
  cut: { label: 'Cut', steps: [25, 50, 100], step: 50, holdPct: 0.75, dir: -1 },
  bulk: { label: 'Bulk', steps: [50, 100, 150], step: 50, holdPct: 0.5, dir: 1 },
}

export const isActivePlan = (plan) => Boolean(plan && PLAN_MODES[plan.mode] && plan.startDate && plan.startKcal > 0)

/** Default floor (cut) or ceiling (bulk) for a starting number. */
export function defaultLimit(mode, startKcal) {
  return mode === 'bulk' ? Math.round((startKcal + 500) / 50) * 50 : Math.max(MIN_TARGET, Math.round((startKcal - 400) / 50) * 50)
}

/** Weight change over the two weeks before `dateKey`, as % of body weight per week (null if unknown). */
export function recentRatePct(weights, dateKey) {
  const from = addDays(dateKey, -14)
  const recent = sortByDate(weights).filter((w) => w.date >= from && w.date < dateKey)
  if (recent.length < 3 || daysBetween(recent[0].date, recent.at(-1).date) < 7) return null
  const rate = weeklyRateKg(recent)
  return rate == null ? null : (rate / recent.at(-1).kg) * 100
}

/**
 * Where a plan stands on `dateKey`: today's number, the week it's in, what
 * happened at each weekly check so far, and the next scheduled change.
 */
export function planState(plan, dateKey, weights = []) {
  if (!isActivePlan(plan)) return null
  const cfg = PLAN_MODES[plan.mode]
  const step = plan.step || cfg.step
  const limit = plan.mode === 'cut' ? Math.max(MIN_TARGET, plan.limit ?? MIN_TARGET) : (plan.limit ?? defaultLimit('bulk', plan.startKcal))
  const clamp = (k) => (cfg.dir < 0 ? Math.max(limit, k) : Math.min(limit, k))

  const elapsed = Math.max(0, daysBetween(plan.startDate, dateKey))
  const weeks = Math.floor(elapsed / 7)
  let kcal = clamp(plan.startKcal)
  const history = []
  for (let w = 1; w <= weeks; w++) {
    const date = addDays(plan.startDate, 7 * w)
    const pct = recentRatePct(weights, date)
    const fast = pct != null && (cfg.dir < 0 ? -pct > cfg.holdPct : pct > cfg.holdPct)
    const atLimit = kcal === limit
    if (!fast && !atLimit) kcal = clamp(kcal + cfg.dir * step)
    history.push({ week: w + 1, date, kcal, pct, status: atLimit ? 'limit' : fast ? 'held' : 'stepped' })
  }

  const atLimit = kcal === limit
  const nextDate = addDays(plan.startDate, 7 * (weeks + 1))
  const nextKcal = atLimit ? kcal : clamp(kcal + cfg.dir * step)
  const weeksToLimit = atLimit ? 0 : Math.ceil(Math.abs(limit - kcal) / step)
  return {
    mode: plan.mode,
    label: cfg.label,
    kcal,
    week: weeks + 1,
    step,
    limit,
    atLimit,
    nextDate,
    nextKcal,
    weeksToLimit,
    history,
    started: daysBetween(plan.startDate, dateKey) >= 0,
  }
}

/** The calorie number in force on a day: the plan's if one is running, else the fixed max. */
export function effectiveTarget(settings, dateKey, weights) {
  const state = planState(settings.plan, dateKey, weights)
  return state ? state.kcal : settings.targetKcal
}
