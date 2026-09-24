// Weekly canteen menus: a grid with a column per weekday (MONDAY…SUNDAY), a
// label column (SOUP, SALAD, DESSERT…), and marker rows like "MORNING SNACKS"
// and "LUNCH". This turns one sheet into { weekStart, week, title, days },
// where days[0..6] (Monday first) list that day's dishes.

import { addDays, daysBetween, fromDateKey, toDateKey } from './dates.js'
import { matchLine } from './menuParser.js'

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const MARKERS = { breakfast: 'breakfast', 'morning snacks': 'morning', 'morning snack': 'morning', lunch: 'lunch', 'evening snacks': 'evening', 'evening snack': 'evening', dinner: 'dinner', snacks: 'evening' }

const norm = (t) => t.toLowerCase().replace(/[^a-z]+/g, ' ').trim()

/** Monday of the week containing `dateKey`. */
export function weekStartOf(dateKey) {
  const weekday = (fromDateKey(dateKey).getDay() + 6) % 7
  return addDays(dateKey, -weekday)
}

/** First dd.mm.yyyy (or dd/mm/yyyy) date in a string, as a date key. */
function firstDate(text) {
  const m = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12)
  return Number.isNaN(d.getTime()) ? null : toDateKey(d)
}

/**
 * Parse a weekly menu grid. `cells` come from readSpreadsheetCells.
 * Returns null when no weekday header row is found.
 */
export function parseWeeklyMenu(cells, fallbackWeekStart) {
  const rows = new Map()
  for (const c of cells) {
    if (!rows.has(c.row)) rows.set(c.row, [])
    rows.get(c.row).push(c)
  }
  const rowNums = [...rows.keys()].sort((a, b) => a - b)

  let headerRow = null
  const dayCol = new Map()
  for (const r of rowNums) {
    const hits = rows.get(r).filter((c) => DAY_NAMES.includes(norm(c.text)))
    if (hits.length >= 3) {
      headerRow = r
      hits.forEach((c) => dayCol.set(c.col, DAY_NAMES.indexOf(norm(c.text))))
      break
    }
  }
  if (headerRow == null) return null

  const allText = cells.map((c) => c.text).join(' ')
  const title = cells.find((c) => c.row < headerRow && /week|menu/i.test(c.text))?.text ?? ''
  const weekNo = Number(allText.match(/week\s*(\d+)/i)?.[1]) || null
  const start = firstDate(title) ?? firstDate(allText)
  const weekStart = start ? weekStartOf(start) : fallbackWeekStart

  const labelCol = Math.min(...cells.map((c) => c.col))
  const days = Object.fromEntries(DAY_NAMES.map((_, i) => [i, []]))
  let section = 'lunch'
  let label = ''
  for (const r of rowNums.filter((n) => n > headerRow)) {
    const row = rows.get(r)
    if (row.some((c) => /allergic|allergen/i.test(c.text))) break
    const marker = row.map((c) => MARKERS[norm(c.text)]).find(Boolean)
    const labelCell = row.find((c) => c.col === labelCol)
    if (labelCell && !dayCol.has(labelCell.col)) label = labelCell.text
    if (marker && row.length === 1) {
      section = marker
      continue
    }
    for (const c of row) {
      if (!dayCol.has(c.col) || /^\*+$/.test(c.text) || c.text.length < 2) continue
      if (/special lunch/i.test(c.text)) continue
      days[dayCol.get(c.col)].push({ text: c.text, category: label, section })
    }
  }
  return { weekStart, week: weekNo, title, days }
}

/**
 * The menu for a date. Uses the week uploaded for that date; otherwise, when
 * the uploaded weeks are consecutive (a cyclic menu), repeats the cycle.
 */
export function menuForDate(menus, dateKey) {
  if (!menus?.length) return null
  const monday = weekStartOf(dateKey)
  const weekday = (fromDateKey(dateKey).getDay() + 6) % 7
  const sorted = [...menus].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  let menu = sorted.find((m) => m.weekStart === monday)
  let repeated = false
  if (!menu) {
    const consecutive = sorted.every((m, i) => i === 0 || daysBetween(sorted[i - 1].weekStart, m.weekStart) === 7)
    const weeksAfter = daysBetween(sorted[0].weekStart, monday) / 7
    if (consecutive && weeksAfter > 0) {
      menu = sorted[weeksAfter % sorted.length]
      repeated = true
    }
  }
  if (!menu) return null
  const entries = menu.days?.[weekday] ?? menu.days?.[String(weekday)] ?? []
  return { menu, weekday, repeated, entries }
}

/** Menu entries split into matched foods (one per dish found) and unmatched text. */
export function menuFoods(entries) {
  const foods = []
  const unknown = []
  const seen = new Set()
  for (const entry of entries) {
    const matches = matchLine(entry.text)
    if (!matches.length) {
      unknown.push(entry)
      continue
    }
    for (const m of matches) {
      if (seen.has(m.food.id)) continue
      seen.add(m.food.id)
      foods.push({ food: m.food, entry })
    }
  }
  return { foods, unknown }
}
