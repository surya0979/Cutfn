// Numbers behind the weekly check-in, the smart calorie target, the safety
// guardrails and the protein helper. All pure functions over logged data.

import { addDays, daysBetween } from './dates.js'
import { exerciseBurn } from './exercise.js'
import { FOOD_DB } from './foodDb.js'
import { resolveBodyWeight, sortByDate, weeklyRateKg } from './weight.js'

/** ~7,700 kcal of energy per kg of body-weight change. */
export const KCAL_PER_KG = 7700
/** Lowest target the app will suggest: a teenager still growing needs fuel. */
export const MIN_TARGET = 1800
/** A day counts as "logged" once it has at least this many entries. */
const MIN_ENTRIES = 2

/** Per-day totals for every date from `from` to `to`, inclusive. */
export function dailyTotals({ meals, exercises, weights, from, to }) {
  const days = []
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d)
  const byDate = Object.fromEntries(days.map((d) => [d, { date: d, eaten: 0, burned: 0, protein: 0, entries: 0 }]))
  for (const m of meals) {
    const day = byDate[m.date]
    if (!day) continue
    day.eaten += m.kcal ?? 0
    day.protein += m.protein ?? 0
    day.entries += 1
  }
  for (const e of exercises) {
    const day = byDate[e.date]
    if (!day) continue
    day.burned += exerciseBurn(e, resolveBodyWeight(weights, e.date).kg)?.kcal ?? 0
  }
  return days.map((d) => {
    const day = byDate[d]
    return { ...day, burned: Math.round(day.burned), logged: day.entries >= MIN_ENTRIES }
  })
}

const round50 = (n) => Math.round(n / 50) * 50

/**
 * Estimate maintenance calories from what was eaten and how weight moved,
 * then suggest a daily max for losing about 0.5% of body weight a week.
 * Uses calories eaten: the daily max caps intake, and exercise is already
 * reflected in how the weight moved.
 */
export function smartTarget({ days, weights, today }) {
  const windowStart = addDays(today, -21)
  const window = days.filter((d) => d.date >= windowStart && d.date < today)
  const logged = window.filter((d) => d.logged)
  const recentWeights = sortByDate(weights).filter((w) => w.date >= windowStart && w.date <= today)
  const span = recentWeights.length > 1 ? daysBetween(recentWeights[0].date, recentWeights.at(-1).date) : 0
  const progress = { loggedDays: logged.length, needDays: 10, weighIns: recentWeights.length, needWeighIns: 4, weighSpan: span, needSpan: 10 }

  if (logged.length < 10 || recentWeights.length < 4 || span < 10) return { status: 'collecting', ...progress }

  const avgEaten = logged.reduce((s, d) => s + d.eaten, 0) / logged.length
  const rateKgWeek = weeklyRateKg(recentWeights)
  const maintenance = avgEaten - (rateKgWeek / 7) * KCAL_PER_KG
  const latestKg = recentWeights.at(-1).kg
  const deficit = Math.min((0.005 * latestKg * KCAL_PER_KG) / 7, 500)
  const suggested = Math.max(MIN_TARGET, round50(maintenance - deficit))
  const plausible = maintenance > 1200 && maintenance < 5000

  return {
    status: plausible ? 'ready' : 'unclear',
    ...progress,
    avgEaten: Math.round(avgEaten),
    rateKgWeek,
    maintenance: round50(maintenance),
    suggested,
    expectedLossKgWeek: ((maintenance - suggested) * 7) / KCAL_PER_KG,
    floored: suggested === MIN_TARGET && maintenance - deficit < MIN_TARGET,
  }
}

/** Warnings when the cut is getting too aggressive. Most severe first. */
export function guardrails({ days, weights, today, targetKcal }) {
  const warnings = []
  const recent = sortByDate(weights).filter((w) => w.date >= addDays(today, -21))
  if (recent.length >= 3 && daysBetween(recent[0].date, recent.at(-1).date) >= 7) {
    const rate = weeklyRateKg(recent)
    const pct = (-rate / recent.at(-1).kg) * 100
    if (pct > 1) {
      warnings.push({ level: 'critical', id: 'fast-loss', pct, rate, title: 'You’re losing weight too fast', body: `About ${pct.toFixed(1)}% of your body weight a week. More than 1% a week at your age risks losing muscle, energy and growth. Eat about 250–300 kcal more a day.` })
    } else if (pct > 0.75) {
      warnings.push({ level: 'warning', id: 'quick-loss', pct, rate, title: 'Weight is dropping quickly', body: `About ${pct.toFixed(1)}% of your body weight a week. That’s at the upper limit; don’t cut calories further.` })
    }
  }
  const lastWeek = days.filter((d) => d.date >= addDays(today, -7) && d.date < today && d.logged)
  const low = lastWeek.filter((d) => d.eaten < 1500)
  if (low.length >= 3) {
    warnings.push({ level: 'warning', id: 'low-intake', title: 'Several very low-calorie days', body: `You ate under 1,500 kcal on ${low.length} of the last 7 days. If that’s accurate, eat more: a growing teenager needs the fuel. If you forgot to log some meals, you can ignore this.` })
  }
  if (targetKcal < MIN_TARGET) {
    warnings.push({ level: 'warning', id: 'low-target', title: 'Your daily max is very low', body: `A daily max under ${MIN_TARGET.toLocaleString()} kcal is too low for most growing teenagers. Consider raising it.` })
  }
  return warnings
}

const STAPLES = ['paneer-tikka', 'scrambled-eggs', 'rajma', 'chole', 'dal', 'milk', 'sundal', 'sprouts', 'string-cheese', 'curd']

/** High-protein picks: today's menu first, then everyday staples. */
export function proteinIdeas(menuFoods, limit = 6) {
  const density = (f) => f.p / Math.max(f.kcal, 1)
  const fromMenu = menuFoods.filter((f) => f.p >= 7 && density(f) >= 0.045).sort((a, b) => b.p - a.p)
  const staples = FOOD_DB.filter((f) => STAPLES.includes(f.id)).sort((a, b) => b.p - a.p)
  const seen = new Set()
  const out = []
  for (const [food, onMenu] of [...fromMenu.map((f) => [f, true]), ...staples.map((f) => [f, false])]) {
    if (seen.has(food.id)) continue
    seen.add(food.id)
    out.push({ food, onMenu })
    if (out.length === limit) break
  }
  return out
}
