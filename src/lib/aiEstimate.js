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
  images_unavailable: 'Photo estimates aren’t available on this device. Type the food instead.',
  image_rejected: 'Claude couldn’t open that photo. Try a JPG or PNG, or take the photo again.',
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

/** Whether this page can send photos to Claude: null while checking. */
export function usePhotoAvailable() {
  const [state, setState] = useState(null)
  useEffect(() => {
    let live = true
    getSample()
      .then((s) => (s ? s.limits().catch(() => null) : null))
      .then((limits) => live && setState(limits?.images ? limits.images : false))
    return () => {
      live = false
    }
  }, [])
  return state
}

/** Re-encode photos Claude can't take (e.g. HEIC) or that are huge as a JPEG. */
async function toSendable(file, limits) {
  const okType = limits.mediaTypes?.includes(file.type)
  if (okType && file.size <= Math.min(limits.maxInputBytes ?? Infinity, 8_000_000)) return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.88))
}

const SHAPE = `Reply with JSON only, in exactly this shape (numbers are for what was actually eaten):
{"items":[{"name":"Dal tadka","portion":"1 bowl (~200 g)","kcal":190,"protein":9,"carbs":26,"fat":6,"assumption":"medium steel katori, filled to the brim"}]}`

const PHOTO_PROMPTS = {
  plate: (note) => `This photo shows food that a high-school student in India on a fat-loss cut ate (often a school canteen tray or thali, sometimes a restaurant or home meal).
Identify each separate food and drink you can see and estimate its portion from visual cues (a standard plate is about 25 cm across; katoris, spoons, glasses and hands help with scale).
Estimate calories and macros per item. Use realistic averages for Indian home and canteen cooking, including oil and ghee.
${note ? `The student adds: "${note}". Apply this (for example, only count what they say they ate).` : ''}
Round kcal to the nearest 5 and grams to whole numbers. In "assumption", say what portion you judged and anything notable (e.g. "fried, looks oily").
If there's no food in the photo, return {"items":[]}.
${SHAPE}`,
  label: (note) => `This photo shows a packaged food or drink: its nutrition label and/or packaging.
Read the product name, the serving size, and the calories, protein, carbohydrate and fat (per serving or per 100 g/ml, whichever is printed).
The student ate: "${note || 'one whole pack'}". Work out the values for exactly that amount.
Return a single item. Use the product name as "name"; in "portion" state the amount eaten; in "assumption" show the label values you used and the math (e.g. "label: 125 kcal per 25 g, ate 50 g → ×2").
If the label isn't readable, return {"items":[],"reason":"what was unclear"}.
${SHAPE}`,
}

/**
 * Estimate calories from a photo: mode "plate" (a meal) or "label"
 * (a nutrition label, scaled to the amount eaten in `note`).
 */
export async function estimateFromPhoto(file, { mode = 'plate', note = '', signal } = {}) {
  const sample = await getSample()
  const limits = sample ? await sample.limits().catch(() => null) : null
  if (!limits?.images) throw new Error('Photo estimates only work in the claude.ai version of Cutfn.')
  let image
  try {
    image = await toSendable(file, limits.images)
  } catch {
    throw new Error('Couldn’t open that photo. Try a JPG or PNG, or take the photo again.')
  }
  let data
  try {
    data = await sample.json(PHOTO_PROMPTS[mode](note.trim().slice(0, 200)), { images: image, signal })
  } catch (err) {
    throw new Error(MESSAGES[err?.code] ?? 'Couldn’t reach Claude for an estimate. Check your connection and try again.')
  }
  const items = cleanItems(data)
  if (!items.length) {
    throw new Error(
      mode === 'label'
        ? `Claude couldn’t read the label${data?.reason ? ` (${String(data.reason).slice(0, 100)})` : ''}. Try a closer, sharper photo of the nutrition table.`
        : 'Claude couldn’t see any food in that photo. Try again with the whole plate in view.',
    )
  }
  return items
}
