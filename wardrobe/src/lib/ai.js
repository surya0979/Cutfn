// Claude, through the page's `sample` capability: it runs on the viewer's own
// Claude account (they approve it once). Anywhere without `window.claude`
// these features stay hidden and pieces can be tagged by hand.

import { useEffect, useState } from 'react'
import { COLOR_BY_VALUE, COLORS, FITS, FORMALITY, MATERIALS, PATTERNS, STYLES, TYPE_BY_VALUE, TYPES, WARMTH, colorLabel, colorWord, typeLabel } from './vocab.js'
import { buildStylistPrompt, parseOutfitLines, resolveOutfit, sameOutfit } from './outfits.js'
import { MAX_PIECES, planPieces, rawPieces, readBox } from './detect.js'

let samplePromise = null
function getSample() {
  if (typeof window === 'undefined' || typeof window.claude?.use !== 'function') return Promise.resolve(null)
  samplePromise ??= window.claude.use('sample').catch(() => null)
  return samplePromise
}

/*
 * Whether photos can go to Claude in this view:
 *   checking  not known yet
 *   ready     the view says it can send photos, or a photo already went through
 *   untested  Claude is here but the view didn't confirm photos: the next photo tries, and settles it
 *   blocked   this view can't send photos (tag by hand)
 *   denied    the viewer hasn't allowed Claude on this page
 *   off       no Claude here at all
 */
let photoState = 'checking'
const photoListeners = new Set()
function setPhotoState(next) {
  if (photoState === next) return
  photoState = next
  for (const listener of photoListeners) listener(next)
}

let photoCheck = null
function checkPhotos() {
  photoCheck ??= getSample().then(async (s) => {
    if (!s) return setPhotoState('off')
    const limits = await s.limits().catch(() => null)
    if (photoState === 'checking') setPhotoState(limits?.images ? 'ready' : 'untested')
  })
  return photoCheck
}

const canTry = (state) => state === 'ready' || state === 'untested'

/** Resolves true when it's worth sending a photo to Claude in this view. */
export async function canSendImages() {
  await checkPhotos()
  return canTry(photoState)
}

/** { text: null|bool, images: null|bool, photos: photo state } — null while checking. */
export function useAi() {
  const [text, setText] = useState(null)
  const [photos, setPhotos] = useState(photoState)
  useEffect(() => {
    let live = true
    getSample().then((s) => live && setText(Boolean(s)))
    checkPhotos()
    const listener = (next) => live && setPhotos(next)
    photoListeners.add(listener)
    setPhotos(photoState)
    return () => {
      live = false
      photoListeners.delete(listener)
    }
  }, [])
  return { text, images: photos === 'checking' ? null : canTry(photos), photos }
}

/** Codes after which every later photo would fail the same way: stop the rest, don't retry. */
export const STOP_CODES = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'images_unavailable', 'rate_limited', 'session_expired'])

/** What a failed photo call says about the view, for every later photo. */
function notePhotoError(code) {
  if (code === 'images_unavailable') setPhotoState('blocked')
  else if (code === 'not_granted') setPhotoState('denied')
  else if (code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') setPhotoState('off')
}

const MESSAGES = {
  not_granted: 'Claude needs your OK to help here. Allow it when asked (or in the page’s Permissions menu), then try again.',
  sampling_disabled: 'Claude isn’t available on this account.',
  not_declared: 'Claude isn’t available in this view, so tag pieces yourself.',
  capability_disabled: 'Claude isn’t available in this view, so tag pieces yourself.',
  capability_removed: 'Claude isn’t available in this view, so tag pieces yourself.',
  rate_limited: 'Too many requests to Claude right now. Wait a minute and try again.',
  session_expired: 'Your claude.ai session expired. Sign in again, then retry.',
  images_unavailable: 'Claude can’t see photos in this view, so tag pieces yourself for now.',
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

const TAG_FIELDS = `Use exactly these values where a list is given:
- category: ${list(TYPES.map((t) => t.value))}
- colors: 1 to 3 of ${list(COLORS.map((c) => c.value))}. Dominant colour first. Use "indigo" for blue denim, "multicolor" only for busy prints.
- pattern: ${list(PATTERNS)}
- material: ${list(MATERIALS)}, or null if you can't tell
- fit: ${list(FITS)}, or null for shoes and accessories
- styles: 1 or 2 of ${list(STYLES)}
- formality: 1 to 5 (${FORMALITY.map((f) => `${f.value} ${f.label.toLowerCase()}`).join(', ')})
- warmth: 1 to 5 (${WARMTH.map((w) => `${w.value} ${w.label.toLowerCase()}`).join(', ')}): how warm it is to wear

Name each piece like a shop listing in 2 to 5 words: colour, then the key detail, then the type ("Olive cargo joggers", "Ivory chikankari kurta", "White leather sneakers"). Mention a brand only if a logo is clearly readable.`

const TAG_EXAMPLE = `{"name":"Navy oxford shirt","category":"shirt","subtype":"oxford button-down","colors":["navy","white"],"pattern":"solid","material":"cotton","fit":"regular","styles":["classic","preppy"],"formality":3,"warmth":2,"brand":null,"description":"One sentence on what stands out and what it pairs well with.","box":[120,40,560,610]}`

/** The tagging prompt: every separate piece in the photo, or only the main one. */
export function tagPrompt({ several = true } = {}) {
  const which = several
    ? `List every separate piece of clothing, footwear or accessory that is clearly visible, up to ${MAX_PIECES}, the most prominent first. A pair (shoes, socks, earrings) is one piece. Never list parts of one garment separately, and skip anything mostly hidden, cut off by the edge of the photo, or too small to make out. If the photo shows one piece, list just that one.`
    : 'Describe the MAIN piece only (the largest garment, shoe or accessory in focus).'
  return `You are cataloguing clothing for the owner's digital wardrobe. The photo shows things they own: on a hanger, laid flat, on a bed or floor, or worn.
${which}

${TAG_FIELDS}

"box" is where the piece sits in the photo: [left, top, right, bottom] as whole numbers from 0 to 1000, where [0,0] is the top-left corner of the photo and [1000,1000] the bottom-right. Keep it tight around that piece.

Reply with JSON only, in exactly this shape:
{"items":[${TAG_EXAMPLE}]}

If there is no clothing, footwear or accessory in the photo, reply {"items":[],"reason":"what the photo shows"}.`
}

// Names Claude reaches for that the palette files under another value ("grey" is read as "gray" first).
const COLOR_ALIASES = {
  'light-gray': 'gray',
  'dark-gray': 'charcoal',
  'off-white': 'cream',
  ivory: 'cream',
  denim: 'indigo',
  'dark-blue': 'navy',
  'sky-blue': 'light-blue',
  'baby-blue': 'light-blue',
  burgundy: 'maroon',
  wine: 'maroon',
  camel: 'tan',
  'dark-green': 'green',
  'army-green': 'olive',
  violet: 'purple',
  multi: 'multicolor',
  'multi-color': 'multicolor',
  multicolour: 'multicolor',
  'multi-colour': 'multicolor',
}

// Types Claude names in its own words, or as a label, mapped to the list.
const TYPE_ALIASES = {
  tee: 't-shirt',
  tshirt: 't-shirt',
  'tee-shirt': 't-shirt',
  tank: 'tank-top',
  camisole: 'tank-top',
  trousers: 'pants',
  chinos: 'pants',
  'cargo-pants': 'pants',
  cargos: 'pants',
  sweatpants: 'joggers',
  trackpants: 'joggers',
  'track-pants': 'joggers',
  jumper: 'sweater',
  pullover: 'sweater',
  trainers: 'sneakers',
  'running-shoes': 'sneakers',
  loafers: 'shoes',
  'dress-shoes': 'shoes',
  oxfords: 'shoes',
  slides: 'sandals',
  'flip-flops': 'sandals',
  slippers: 'sandals',
  kolhapuris: 'juttis',
  mojaris: 'juttis',
  cap: 'hat',
  beanie: 'hat',
  earrings: 'jewellery',
  necklace: 'jewellery',
  bracelet: 'jewellery',
  ring: 'jewellery',
  jewelry: 'jewellery',
  backpack: 'bag',
  handbag: 'bag',
  tote: 'bag',
  wallet: 'other',
  waistcoat: 'vest',
  gilet: 'vest',
  windbreaker: 'jacket',
  'bomber-jacket': 'jacket',
  'denim-jacket': 'jacket',
  'leather-jacket': 'jacket',
  stole: 'scarf',
  sari: 'saree',
  shawl: 'scarf',
}

const slug = (v) => String(v ?? '').toLowerCase().trim().replace(/[\s_]+/g, '-')

/** Claude's type → a value from the list, or null. Takes "T-shirt", "tank top", "Sneaker", "trousers"... */
export function readType(raw) {
  const key = slug(raw)
  if (!key) return null
  const label = TYPES.find((t) => slug(t.label) === key)?.value
  // Plural or singular: "kurtas", "dresses", "sneaker", "boot".
  const forms = [key, `${key}s`, key.replace(/s$/, ''), key.replace(/es$/, '')]
  for (const k of [...forms, label, ...forms.map((f) => TYPE_ALIASES[f])]) {
    if (k && TYPE_BY_VALUE[k]) return k
  }
  return null
}

/** Claude's colour → a palette value, or null. "Dark grey" → charcoal, "olive green" → olive, "dark navy" → navy. */
export function readColor(raw) {
  const key = slug(raw).replace(/grey/g, 'gray')
  if (COLOR_BY_VALUE[key]) return key
  if (COLOR_BY_VALUE[COLOR_ALIASES[key]]) return COLOR_ALIASES[key]
  const words = key.split('-')
  if (words.length < 2) return null
  return [words[0], words.at(-1)].find((w) => COLOR_BY_VALUE[w]) ?? null
}

/**
 * Normalise Claude's tags against the vocabulary; unknown values are dropped.
 * Returns null without a known type, unless `loose`: then a piece Claude named
 * but typed oddly comes back with category null, for the owner to finish.
 */
export function cleanTags(raw, { loose = false } = {}) {
  const category = readType(raw?.category)
  if (!category && !(loose && slug(raw?.category) && raw?.name)) return null
  const colors = (Array.isArray(raw.colors) ? raw.colors : [raw.colors])
    .map(readColor)
    .filter(Boolean)
    .filter((c, i, a) => a.indexOf(c) === i)
    .slice(0, 3)
  const text = (v, max) => (v == null ? '' : String(v).trim().slice(0, max))
  return {
    name: text(raw.name, 60) || `${colors[0] ? colorWord(colors[0]) + ' ' : ''}${typeLabel(category).split(' / ')[0].toLowerCase()}`,
    category,
    subtype: text(raw.subtype, 40),
    colors,
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

/**
 * Claude's answer for one photo → a filing plan (see planPieces), or null if it
 * saw no clothing. A piece with a type outside the list still gets its own cut
 * (category null, for the owner to pick) rather than vanishing; it never leads.
 */
export function readTagAnswer(answer, { several = true } = {}) {
  const pieces = rawPieces(answer)
    .map((raw) => {
      const tags = cleanTags(raw, { loose: true })
      return tags && { tags, box: readBox(raw?.box) }
    })
    .filter(Boolean)
  const lead = pieces.findIndex((p) => p.tags.category)
  if (lead < 0) return null
  return planPieces([pieces[lead], ...pieces.filter((_, i) => i !== lead)], { several })
}

/**
 * Ask Claude to tag one photo. Resolves { split: false, piece } or
 * { split: true, pieces } (each piece { tags, box }); rejects with a friendly Error.
 */
export async function tagGarment(photo, { signal, several = true } = {}) {
  const sample = await getSample()
  if (!sample) {
    setPhotoState('off')
    throw friendly({ code: 'sampling_disabled' })
  }
  let answer
  try {
    // No answer cache: a photo is only ever sent again to get a fresh look (Re-tag, Retry).
    answer = await sample.json(tagPrompt({ several }), { images: photo, modelTier: 'quick', signal, cache: false })
  } catch (err) {
    notePhotoError(err?.code)
    throw friendly(err, 'Couldn’t reach Claude to tag this piece. You can tag it yourself or retry.')
  }
  setPhotoState('ready')
  const plan = readTagAnswer(answer, { several })
  if (!plan) {
    const reason = answer?.reason ? ` (${String(answer.reason).slice(0, 80)})` : ''
    const e = new Error(`Claude didn’t see clothing in this photo${reason}. Tag it yourself or retake it.`)
    e.code = 'not_clothing'
    throw e
  }
  return plan
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
    notePhotoError(err?.code)
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
