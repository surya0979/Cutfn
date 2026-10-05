// Claude, through the page's `sample` capability: it runs on the viewer's own
// Claude account (they approve it once). Anywhere without `window.claude`
// these features stay hidden and pieces can be tagged by hand.

import { useEffect, useState } from 'react'
import { COLOR_BY_VALUE, COLORS, FITS, FORMALITY, MATERIALS, PATTERNS, STYLES, TYPE_BY_VALUE, TYPES, WARMTH, colorLabel, colorWord, typeLabel } from './vocab.js'
import { buildStylistPrompt, parseOutfitLines, resolveOutfit, sameOutfit } from './outfits.js'

let samplePromise = null
function getSample() {
  if (typeof window === 'undefined' || typeof window.claude?.use !== 'function') return Promise.resolve(null)
  samplePromise ??= window.claude.use('sample').catch(() => null)
  return samplePromise
}

/** Resolves true when this view can send photos to Claude. */
export async function canSendImages() {
  const s = await getSample()
  const limits = s ? await s.limits().catch(() => null) : null
  return Boolean(limits?.images)
}

/** { text: null|bool, images: null|bool } — null while checking. */
export function useAi() {
  const [state, setState] = useState({ text: null, images: null })
  useEffect(() => {
    let live = true
    getSample()
      .then(async (s) => {
        const limits = s ? await s.limits().catch(() => null) : null
        if (live) setState({ text: Boolean(s), images: Boolean(limits?.images) })
      })
      .catch(() => live && setState({ text: false, images: false }))
    return () => {
      live = false
    }
  }, [])
  return state
}

const MESSAGES = {
  not_granted: 'Claude needs your OK to help here. Allow it when asked (or in the page’s Permissions menu), then try again.',
  sampling_disabled: 'Claude isn’t available on this account.',
  rate_limited: 'Too many requests to Claude right now. Wait a minute and try again.',
  session_expired: 'Your claude.ai session expired. Sign in again, then retry.',
  images_unavailable: 'Photo tagging isn’t available in this view. Tag the piece yourself for now.',
  image_rejected: 'Claude couldn’t open that photo. Try a JPG or PNG.',
  invalid_json: 'Claude’s answer came back in an unusable form. Try again.',
  refused: 'Claude declined that request. Try different wording.',
  prompt_too_large: 'Your wardrobe is too large to send in one go. Move some pieces to the laundry and try again.',
  empty_completion: 'Claude came back empty. Try again.',
}

/** An Error whose message is ready to show; `code` says what happened. */
function friendly(err, fallback = 'Couldn’t reach Claude. Check your connection and try again.') {
  const e = new Error(MESSAGES[err?.code] ?? fallback)
  e.code = err?.code ?? 'upstream_error'
  return e
}

const list = (values) => values.join(', ')
const pick = (v, allowed) => (allowed.includes(v) ? v : null)
const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

const TAG_PROMPT = `You are cataloguing one piece of clothing for the owner's digital wardrobe. The photo shows something they own: on a hanger, laid flat, on a bed or floor, or worn. Describe the MAIN item only (the largest garment, shoe or accessory in focus).

Use exactly these values where a list is given:
- category: ${list(TYPES.map((t) => t.value))}
- colors: 1 to 3 of ${list(COLORS.map((c) => c.value))}. Dominant colour first. Use "indigo" for blue denim, "multicolor" only for busy prints.
- pattern: ${list(PATTERNS)}
- material: ${list(MATERIALS)}, or null if you can't tell
- fit: ${list(FITS)}, or null for shoes and accessories
- styles: 1 or 2 of ${list(STYLES)}
- formality: 1 to 5 (${FORMALITY.map((f) => `${f.value} ${f.label.toLowerCase()}`).join(', ')})
- warmth: 1 to 5 (${WARMTH.map((w) => `${w.value} ${w.label.toLowerCase()}`).join(', ')}): how warm it is to wear

Name it like a shop listing in 2 to 5 words: colour, then the key detail, then the type ("Olive cargo joggers", "Ivory chikankari kurta", "White leather sneakers"). Mention a brand only if a logo is clearly readable.

Reply with JSON only, in exactly this shape:
{"name":"Navy oxford shirt","category":"shirt","subtype":"oxford button-down","colors":["navy","white"],"pattern":"solid","material":"cotton","fit":"regular","styles":["classic","preppy"],"formality":3,"warmth":2,"brand":null,"description":"One sentence on what stands out and what it pairs well with."}

If there is no clothing, footwear or accessory in the photo, reply {"category":null,"reason":"what the photo shows"}.`

/** Normalise Claude's tags against the vocabulary; unknown values are dropped. */
export function cleanTags(raw) {
  const category = TYPE_BY_VALUE[raw?.category] ? raw.category : null
  if (!category) return null
  const colors = (Array.isArray(raw.colors) ? raw.colors : [raw.colors])
    .map((c) => String(c ?? '').toLowerCase().trim().replace(/\s+/g, '-').replace('grey', 'gray'))
    .filter((c) => COLOR_BY_VALUE[c])
    .filter((c, i, a) => a.indexOf(c) === i)
    .slice(0, 3)
  const text = (v, max) => (v == null ? '' : String(v).trim().slice(0, max))
  return {
    name: text(raw.name, 60) || `${colors[0] ? colorWord(colors[0]) + ' ' : ''}${typeLabel(category).split(' / ')[0].toLowerCase()}`,
    category,
    subtype: text(raw.subtype, 40),
    colors: colors.length ? colors : ['multicolor'],
    pattern: pick(raw.pattern, PATTERNS) ?? 'solid',
    material: pick(raw.material, MATERIALS),
    fit: pick(raw.fit, FITS),
    styles: (Array.isArray(raw.styles) ? raw.styles : []).filter((s) => STYLES.includes(s)).slice(0, 3),
    formality: clampInt(raw.formality, 1, 5, 2),
    warmth: clampInt(raw.warmth, 1, 5, 3),
    brand: text(raw.brand, 40),
    description: text(raw.description, 220),
  }
}

/** Ask Claude to tag one garment photo. Resolves cleaned tags; rejects with a friendly Error. */
export async function tagGarment(photo, { signal } = {}) {
  const sample = await getSample()
  if (!sample) throw friendly({ code: 'sampling_disabled' })
  let raw
  try {
    raw = await sample.json(TAG_PROMPT, { images: photo, modelTier: 'quick', signal })
  } catch (err) {
    throw friendly(err, 'Couldn’t reach Claude to tag this piece. You can tag it yourself or retry.')
  }
  const tags = cleanTags(raw)
  if (!tags) {
    const e = new Error(`Claude didn’t see clothing in this photo${raw?.reason ? ` (${String(raw.reason).slice(0, 80)})` : ''}. Tag it yourself or retake it.`)
    e.code = 'not_clothing'
    throw e
  }
  return tags
}

/**
 * Ask Claude for outfits. Outfits stream in one by one through onOutfit.
 * Resolves the full list; rejects with a friendly Error (code 'cancelled' on Stop).
 */
export async function curateOutfits({ items, plan, settings, taste, today, avoid = [], count = 3, signal, onOutfit, onStart }) {
  const sample = await getSample()
  if (!sample) throw friendly({ code: 'sampling_disabled' })
  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]))
  const { prompt, numbers } = buildStylistPrompt({ items, plan, settings, taste, today, avoid, count })

  const seen = []
  const take = (text) => {
    for (const raw of parseOutfitLines(text)) {
      const outfit = resolveOutfit(raw, numbers, itemsById, plan.mustInclude)
      if (!outfit) continue
      if (seen.some((o) => sameOutfit(o.itemIds, outfit.itemIds))) continue
      if (avoid.some((ids) => sameOutfit(ids, outfit.itemIds))) continue
      seen.push(outfit)
      onOutfit?.(outfit)
    }
  }

  let started = false
  try {
    const { text } = await sample(prompt, {
      modelTier: 'default',
      cache: false,
      signal,
      onText: ({ text }) => {
        if (!started) {
          started = true
          onStart?.()
        }
        // Only complete lines; the last one may still be arriving.
        take(text.slice(0, text.lastIndexOf('\n') + 1))
      },
    })
    take(text)
  } catch (err) {
    if (err?.text) take(err.text)
    if (err?.code === 'cancelled') {
      const e = new Error('Stopped.')
      e.code = 'cancelled'
      e.partial = seen
      throw e
    }
    if (seen.length) return seen
    throw friendly(err)
  }
  if (!seen.length) {
    const e = new Error('Claude couldn’t put a full outfit together from what’s clean right now. Add more pieces or empty the laundry, then try again.')
    e.code = 'empty'
    throw e
  }
  return seen
}

const GAPS_SHAPE = `{"summary":"Two sentences on what the wardrobe does well and what holds it back.","buy":[{"piece":"White canvas sneakers","why":"Would finish most of your casual looks","pairsWith":[3,8,12]}],"underused":[{"item":5,"idea":"Wear the mustard kurta with your blue jeans and white sneakers."}]}`

/** Ask Claude which pieces would unlock the most new outfits, and how to wear what's ignored. */
export async function wardrobeGaps({ items, settings, today, signal }) {
  const sample = await getSample()
  if (!sample) throw friendly({ code: 'sampling_disabled' })
  const pool = items.filter((i) => i.category).slice(0, 200)
  const numbers = new Map(pool.map((item, i) => [i + 1, item.id]))
  const lines = pool.map((item, i) => {
    const worn = item.wearCount ? `worn ${item.wearCount}×` : 'never worn'
    return `#${i + 1} ${item.name} | ${typeLabel(item.category)} | ${(item.colors ?? []).map(colorLabel).join(', ')} | formality ${item.formality ?? 2}/5 | ${worn}`
  })
  const prompt = `You are a personal stylist auditing someone's wardrobe to find the few purchases that would unlock the most new outfits, and to help them wear what they ignore.
Dressing for: ${settings.dressingFor === 'mens' ? 'menswear' : settings.dressingFor === 'womens' ? 'womenswear' : 'no preference given'}. Lives in: ${settings.city?.trim() || 'India'}.${settings.styles?.length ? ` Likes: ${settings.styles.join(', ')}.` : ''}${settings.notes?.trim() ? ` About them: ${settings.notes.trim().slice(0, 300)}.` : ''}
Today is ${today}.

WARDROBE
${lines.join('\n')}

Suggest 3 to 5 versatile pieces to buy (most useful first), each pairing with at least 3 pieces they own. Prefer affordable basics before statement pieces. Then pick up to 3 pieces that are never or rarely worn and give one concrete outfit idea for each using what they own.
Reply with JSON only, in exactly this shape:
${GAPS_SHAPE}`
  let data
  try {
    data = await sample.json(prompt, { modelTier: 'default', signal })
  } catch (err) {
    if (err?.code === 'cancelled') throw Object.assign(new Error('Stopped.'), { code: 'cancelled' })
    throw friendly(err)
  }
  const ids = (arr) => (Array.isArray(arr) ? arr : []).map((n) => numbers.get(Number(String(n).replace('#', '')))).filter(Boolean)
  return {
    summary: String(data?.summary ?? '').slice(0, 400),
    buy: (Array.isArray(data?.buy) ? data.buy : [])
      .map((b) => ({ piece: String(b?.piece ?? '').slice(0, 60), why: String(b?.why ?? '').slice(0, 200), pairsWith: ids(b?.pairsWith).slice(0, 6) }))
      .filter((b) => b.piece)
      .slice(0, 5),
    underused: (Array.isArray(data?.underused) ? data.underused : [])
      .map((u) => ({ itemId: numbers.get(Number(String(u?.item).replace('#', ''))), idea: String(u?.idea ?? '').slice(0, 240) }))
      .filter((u) => u.itemId && u.idea)
      .slice(0, 3),
    at: Date.now(),
  }
}

const FIT_CHECK = (context) => `This is a photo of someone wearing an outfit (usually a mirror selfie). Act as a kind, honest personal stylist.
${context ? `Their plan: ${context}` : ''}
Look at the outfit only. Never comment on the person's body, face or attractiveness.
Reply with JSON only, in exactly this shape:
{"score":8,"verdict":"Five to eight words summing it up","good":["What works, specific to what you see"],"tweaks":["One small, concrete change that would lift it"]}
Give 1 to 3 items in "good" and 1 to 2 in "tweaks". Score out of 10 for how well it's put together and suits the plan.`

/** Rate an outfit from a mirror photo. */
export async function fitCheck(photo, { context = '', signal } = {}) {
  const sample = await getSample()
  if (!sample) throw friendly({ code: 'sampling_disabled' })
  let data
  try {
    data = await sample.json(FIT_CHECK(context.slice(0, 200)), { images: photo, modelTier: 'default', signal, cache: false })
  } catch (err) {
    if (err?.code === 'cancelled') throw Object.assign(new Error('Stopped.'), { code: 'cancelled' })
    throw friendly(err)
  }
  const strs = (a, n) => (Array.isArray(a) ? a : []).map((s) => String(s).slice(0, 200)).filter(Boolean).slice(0, n)
  return {
    score: clampInt(data?.score, 1, 10, null),
    verdict: String(data?.verdict ?? '').slice(0, 80),
    good: strs(data?.good, 3),
    tweaks: strs(data?.tweaks, 2),
  }
}
