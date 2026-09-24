import { describe, expect, it } from 'vitest'
import { addDays } from './dates.js'
import { dailyTotals, guardrails, MIN_TARGET, proteinIdeas, smartTarget } from './insights.js'
import { FOOD_BY_ID } from './foodDb.js'
import { menuForDate, parseWeeklyMenu, weekStartOf } from './weeklyMenu.js'
import { timedBurn } from './exercise.js'

const today = '2026-09-24'
const meal = (date, kcal, protein = 0) => ({ date, kcal, protein, createdAt: 0 })

function history({ days = 21, eat = 2200, startKg = 80, lossPerWeek = 0.5 }) {
  const meals = []
  const weights = []
  for (let i = days; i >= 1; i--) {
    const d = addDays(today, -i)
    meals.push(meal(d, eat / 2, 40), meal(d, eat / 2, 40))
    if (i % 2 === 0) weights.push({ date: d, kg: startKg - ((days - i) / 7) * lossPerWeek })
  }
  return { meals, weights }
}

describe('smart target', () => {
  it('waits for enough data', () => {
    const { meals, weights } = history({ days: 5 })
    const days = dailyTotals({ meals, exercises: [], weights, from: addDays(today, -42), to: today })
    const t = smartTarget({ days, weights, today })
    expect(t.status).toBe('collecting')
    expect(t.loggedDays).toBe(5)
  })

  it('derives maintenance from intake and weight change', () => {
    const { meals, weights } = history({ eat: 2200, lossPerWeek: 0.5 })
    const days = dailyTotals({ meals, exercises: [], weights, from: addDays(today, -42), to: today })
    const t = smartTarget({ days, weights, today })
    expect(t.status).toBe('ready')
    // 0.5 kg/week ≈ 550 kcal/day below maintenance → ~2,750
    expect(t.maintenance).toBeGreaterThan(2650)
    expect(t.maintenance).toBeLessThan(2850)
    expect(t.suggested).toBeLessThan(t.maintenance)
    expect(t.suggested).toBeGreaterThanOrEqual(MIN_TARGET)
  })

  it('never suggests below the floor', () => {
    const { meals, weights } = history({ eat: 1500, lossPerWeek: 0 })
    const days = dailyTotals({ meals, exercises: [], weights, from: addDays(today, -42), to: today })
    expect(smartTarget({ days, weights, today }).suggested).toBe(MIN_TARGET)
  })
})

describe('guardrails', () => {
  it('flags fast loss and low intake', () => {
    const { meals, weights } = history({ eat: 1300, lossPerWeek: 1.2 })
    const days = dailyTotals({ meals, exercises: [], weights, from: addDays(today, -42), to: today })
    const ids = guardrails({ days, weights, today, targetKcal: 1600 }).map((w) => w.id)
    expect(ids).toEqual(['fast-loss', 'low-intake', 'low-target'])
  })

  it('stays quiet on a steady cut', () => {
    const { meals, weights } = history({ eat: 2200, lossPerWeek: 0.4 })
    const days = dailyTotals({ meals, exercises: [], weights, from: addDays(today, -42), to: today })
    expect(guardrails({ days, weights, today, targetKcal: 2200 })).toEqual([])
  })
})

it('suggests protein from the menu before staples', () => {
  const ideas = proteinIdeas([FOOD_BY_ID.rajma, FOOD_BY_ID['gulab-jamun']])
  expect(ideas[0]).toMatchObject({ onMenu: true, food: { id: 'rajma' } })
  expect(ideas.some((i) => i.food.id === 'gulab-jamun')).toBe(false)
})

it('burns calories for football and gym by weight', () => {
  expect(timedBurn({ kind: 'football', minutes: 60, level: 'moderate', weightKg: 80 }).kcal).toBeCloseTo(680)
  expect(timedBurn({ kind: 'gym', minutes: 45, level: 'hard', weightKg: 60 }).kcal).toBeCloseTo(270)
})

describe('weekly menu', () => {
  const cell = (row, col, text) => ({ row, col, text })
  const cells = [
    cell(1, 2, 'WEEK 2 - LUNCH CYCLIC MENU FOR THE YEAR 2026- 2027 (21.09.2026 to 27.09.2026)'),
    cell(2, 2, 'GUIDELINES'), cell(2, 3, 'MONDAY'), cell(2, 4, 'TUESDAY'), cell(2, 5, 'WEDNESDAY'), cell(2, 6, 'THURSDAY'),
    cell(3, 2, 'MORNING SNACKS'),
    cell(4, 2, 'JUICE'), cell(4, 3, 'MINT LEMON JUICE'), cell(4, 6, 'GINGER LEMON JUICE'),
    cell(5, 2, 'LUNCH'),
    cell(6, 2, 'SOUP'), cell(6, 3, '**********'), cell(6, 4, 'CORN CHOWDER'),
    cell(7, 2, 'INDIAN VEG'), cell(7, 3, 'Paneer butter masala'), cell(7, 6, 'KADI PAKODI'),
    cell(8, 2, 'ALLERGIC COLOUR CODE'), cell(9, 3, 'EGG'),
  ]
  const week = parseWeeklyMenu(cells, null)

  it('reads the week, days, sections and categories', () => {
    expect(week.weekStart).toBe('2026-09-21')
    expect(week.week).toBe(2)
    expect(week.days[0]).toEqual([
      { text: 'MINT LEMON JUICE', category: 'JUICE', section: 'morning' },
      { text: 'Paneer butter masala', category: 'INDIAN VEG', section: 'lunch' },
    ])
    expect(week.days[3].map((e) => e.text)).toEqual(['GINGER LEMON JUICE', 'KADI PAKODI'])
  })

  it('repeats a cyclic menu after the uploaded weeks', () => {
    const w1 = { ...week, weekStart: '2026-09-14', week: 1 }
    const menus = [w1, week]
    expect(menuForDate(menus, '2026-09-24')).toMatchObject({ repeated: false, weekday: 3 })
    expect(menuForDate(menus, '2026-09-28')).toMatchObject({ repeated: true, menu: { week: 1 } })
    expect(menuForDate(menus, '2026-10-05').menu.week).toBe(2)
    expect(menuForDate(menus, '2026-09-01')).toBeNull()
    expect(weekStartOf('2026-09-27')).toBe('2026-09-21')
  })
})
