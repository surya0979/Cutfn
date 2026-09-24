// Calorie and macro estimates from Claude, for foods the built-in database
// doesn't know or that the user describes in their own words
// ("bowl of dal makhani with 2 chapatis").
//
// On claude.ai the page can ask Claude through the `sample` capability,
// which runs on the viewer's own Claude account (they approve it once).
// Anywhere else there is no `window.claude`, so the feature stays hidden.

import { useEffect, useState } from 'react'

let samplePromise = null
function getSample() {
  if (typeof window === 'undefined' || typeof window.claude?.use !== 'function') return Promise.resolve(null)
  samplePromise ??= window.claude.use('sample').catch(() => null)
  return samplePromise
}

/** Whether AI estimates can run on this page: null while checking, then true or false. */
export function useAiAvailable() {
  const [available, setAvailable] = useState(null)
  useEffect(() => {
    let live = true
    getSample().then((s) => live && setAvailable(Boolean(s)))
    return () => {
      live = false
    }
  }, [])
  return available
}

const PROMPT = (foods) => `You estimate nutrition for a high-school student in India who is on a fat-loss cut and logs what they eat.
Most meals come from their school canteen (Indian vegetarian lunches: dal, sabzi, paneer dishes, chapati, rice, curd, Indian sweets) plus snacks and packaged drinks.

Estimate calories and macros for this food:
"""
${foods}
"""

Rules:
- If it lists several foods, return one item per food.
- Honor any quantity given (e.g. "2 chapatis", "half plate"). Otherwise assume one typical school canteen serving, and say what you assumed.
- For a packaged product, use its usual label values for the stated or smallest common pack size.
- Use realistic averages, not best-case numbers. Round kcal to the nearest 5 and grams to whole numbers.
- If something is not a food or drink, leave it out.

Reply with JSON only, in exactly this shape:
{"items":[{"name":"Dal makhani","portion":"1 bowl (~200 g)","kcal":280,"protein":11,"carbs":28,"fat":14,"assumption":"restaurant-style with butter and cream"}]}`

const num = (v, max) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), max) : 0
}

function cleanItems(data) {
  const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  return list
    .map((it) => ({
      name: String(it?.name ?? '').trim().slice(0, 80),
      portion: String(it?.portion ?? '').trim().slice(0, 60),
      assumption: String(it?.assumption ?? '').trim().slice(0, 140),
      kcal: num(it?.kcal, 5000),
      protein: num(it?.protein, 400),
      carbs: num(it?.carbs, 800),
      fat: num(it?.fat, 400),
    }))
    .filter((it) => it.name && it.kcal > 0)
}

const MESSAGES = {
  not_granted: 'AI estimates need your OK. Allow Claude when asked, or enter calories yourself.',
  rate_limited: 'Too many AI requests right now. Wait a moment and try again.',
  cancelled: 'Estimate cancelled.',
  invalid_json: 'Claude’s answer didn’t come back in a usable form. Try again, or describe the food a bit differently.',
}

/**
 * Ask Claude to estimate one or more foods described in plain words.
 * Resolves to [{name, portion, assumption, kcal, protein, carbs, fat}];
 * rejects with an Error whose message is ready to show.
 */
export async function estimateFoods(description, { signal } = {}) {
  const sample = await getSample()
  if (!sample) throw new Error('AI estimates only work in the claude.ai version of Cutfn.')
  try {
    const data = await sample.json(PROMPT(description.trim()), { modelTier: 'quick', signal })
    const items = cleanItems(data)
    if (!items.length) throw Object.assign(new Error(), { code: 'empty' })
    return items
  } catch (err) {
    if (err?.code === 'empty') throw new Error('Claude couldn’t find a food in that. Try naming the dish.')
    throw new Error(MESSAGES[err?.code] ?? 'Couldn’t reach Claude for an estimate. Check your connection and try again.')
  }
}

/** Ask Claude a free-form question and get plain text back. */
export async function askClaude(prompt, { signal } = {}) {
  const sample = await getSample()
  if (!sample) throw new Error('AI features only work in the claude.ai version of Cutfn.')
  try {
    const { text } = await sample(prompt, { modelTier: 'quick', signal })
    return text.trim()
  } catch (err) {
    throw new Error(MESSAGES[err?.code] ?? 'Couldn’t reach Claude. Check your connection and try again.')
  }
}
