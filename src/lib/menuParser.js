// Turns free-form menu text (typed, pasted, or OCR output) into food matches.
//
// Each line is normalized into tokens and every alias in FOOD_DB is slid
// across it. Tokens match exactly, by plural stem ("tacos" → "taco"), or —
// for longer words — within a small edit distance, which absorbs typical OCR
// slips like "Chiken Nugets". Overlapping candidates are resolved greedily,
// longest alias first, so one line can yield several foods
// ("Cheeseburger w/ Fries & Milk") without "mac and cheese" splitting apart.

import { FOOD_DB } from './foodDb.js'

// Words that carry no food meaning. They never fuzzy-match (so "Spring Break"
// can't turn into "bread") and they don't count toward an unrecognized line.
const STOP = new Set(
  `monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun
  january february march april may june july august september october november december
  jan feb mar apr jun jul aug sep sept oct nov dec
  menu menus lunch lunches breakfast dinner week weekly served serve serving servings daily day today
  choice choices choose offered available entree entrees side sides or and with of the a an all
  meal meals include includes included no school holiday break spring winter fall summer grade grades
  elementary middle high district price prices free reduced student students adult adults cafeteria
  nutrition calories cal kcal oz ounce ounces cup cups each per assorted fresh hot cold featuring
  special option options main dish station grab go new homemade daily plus your pick one two
  cyclic guidelines conti accompaniments snacks morning beverage lentil inter national international dutch year
  allergic colour color code peanut sesame gluten gelatine dairy nuts veg for to products`.split(/\s+/),
)

export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bw\//g, ' with ')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const stem = (t) => (t.length > 3 ? t.replace(/(es|s)$/, '') : t)

export function editDistance(a, b) {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** 3 = exact, 2 = same plural stem, 1 = close OCR-style typo, 0 = no match. */
function tokenScore(word, aliasWord) {
  if (word === aliasWord) return 3
  if (stem(word) === stem(aliasWord)) return 2
  const shortest = Math.min(word.length, aliasWord.length)
  if (shortest < 5 || STOP.has(word) || /\d/.test(word)) return 0
  const tolerance = shortest >= 8 ? 2 : 1
  if (Math.abs(word.length - aliasWord.length) > tolerance) return 0
  return editDistance(word, aliasWord) <= tolerance ? 1 : 0
}

// Pre-tokenize every alias once.
const ALIASES = FOOD_DB.flatMap((food, order) =>
  food.aliases.map((alias) => {
    const tokens = normalize(alias).split(' ')
    return { food, tokens, chars: tokens.join(' ').length, order }
  }),
)

/** All foods found in a single line, left to right. */
export function matchLine(line) {
  const words = normalize(line).split(' ').filter(Boolean)
  if (!words.length) return []

  const candidates = []
  for (const alias of ALIASES) {
    const n = alias.tokens.length
    for (let start = 0; start + n <= words.length; start++) {
      let quality = 0
      let fuzzy = false
      let k = 0
      for (; k < n; k++) {
        const score = tokenScore(words[start + k], alias.tokens[k])
        if (!score) break
        quality += score
        if (score === 1) fuzzy = true
      }
      if (k === n) candidates.push({ ...alias, start, end: start + n, quality, fuzzy })
    }
  }

  candidates.sort(
    (a, b) =>
      b.tokens.length - a.tokens.length ||
      b.quality - a.quality ||
      b.chars - a.chars ||
      a.order - b.order,
  )

  const used = new Array(words.length).fill(false)
  const chosen = []
  for (const c of candidates) {
    let free = true
    for (let i = c.start; i < c.end; i++) if (used[i]) free = false
    if (!free) continue
    for (let i = c.start; i < c.end; i++) used[i] = true
    chosen.push({
      food: c.food,
      start: c.start,
      matchedText: words.slice(c.start, c.end).join(' '),
      fuzzy: c.fuzzy,
    })
  }
  return chosen.sort((a, b) => a.start - b.start)
}

export function splitLines(text) {
  return text
    .split(/[\n\r;,•·|]+|\s[-–—]\s|\s\/\s/)
    .map((line) => line.trim())
    .filter(Boolean)
}

const looksLikeFood = (line) =>
  normalize(line)
    .split(' ')
    .some((w) => w.length >= 3 && !STOP.has(w) && !/\d/.test(w))

/**
 * Parse a whole menu. Returns unique foods in first-seen order (with how
 * many times each appeared) plus lines that looked like food but didn't
 * match anything, so they can be logged by hand.
 */
export function parseMenu(text) {
  const items = new Map()
  const unmatched = []
  const seenUnmatched = new Set()

  for (const line of splitLines(text)) {
    const matches = matchLine(line)
    if (!matches.length) {
      const key = normalize(line)
      if (looksLikeFood(line) && !seenUnmatched.has(key)) {
        seenUnmatched.add(key)
        unmatched.push(line.slice(0, 60))
      }
      continue
    }
    for (const m of matches) {
      const existing = items.get(m.food.id)
      if (existing) {
        existing.count++
        // Prefer showing a clean read over an OCR-fuzzy one.
        if (existing.fuzzy && !m.fuzzy) Object.assign(existing, { fuzzy: false, matchedText: m.matchedText })
      } else {
        items.set(m.food.id, { food: m.food, matchedText: m.matchedText, fuzzy: m.fuzzy, count: 1 })
      }
    }
  }
  return { items: [...items.values()], unmatched }
}

export const SAMPLE_MENU = `WEEK 2 LUNCH MENU
Monday: Paneer Butter Masala, Dal Makhani, Chapati, Plain Rice
Tuesday: Penne Arrabiata, Palak Paneer, Arahar Dal
Wednesday: Rajma Masala, Jeera Rice, Kosumbari
Thursday: Mac And Cheese, Kadi Pakodi, Ice Cream
Friday Special: Veg Burritos, Chiken Burritos
Daily: Papad, Pickle, Curd, Seasonal Fruit, Paper Boat Coconut Water`
