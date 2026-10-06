// Pure outfit logic: which body slot each piece fills, keeping outfits
// wearable, ranking pieces for the weather, and the stylist prompt.
// Slot rules are ported from wardrowbe's backend (app/utils/clothing.py).

import { colorLabel, occasionLabel, roleOf, typeLabel, typeOf, weatherOf } from './vocab.js'
import { daysBetween } from './dates.js'

// A dress covers top and bottom; a suit includes its trousers but leaves
// room for a coat over it.
const ROLE_SLOTS = {
  full_body: ['base_top', 'bottom'],
  suit: ['bottom', 'suit'],
}

export function slotsFor(category) {
  const role = roleOf(category)
  // Accessories don't share a body slot, but two of the same kind (two bags) still clash.
  if (role === 'accessory') return [`accessory:${category}`]
  return ROLE_SLOTS[role] ?? [role]
}

/**
 * Drop pieces that fight over a slot. Mandatory ids win, then one-piece
 * garments (a dress beats separates), then list order.
 */
export function dedupeBySlot(ids, itemsById, mandatory = []) {
  const wanted = new Set(mandatory)
  const known = ids.filter((id, i) => itemsById[id] && ids.indexOf(id) === i)
  const first = known.filter((id) => wanted.has(id))
  const rest = known.filter((id) => !wanted.has(id))
  const multi = rest.filter((id) => slotsFor(itemsById[id].category).length > 1)
  const single = rest.filter((id) => slotsFor(itemsById[id].category).length <= 1)

  const claimed = new Set()
  const kept = new Set()
  for (const id of [...first, ...multi, ...single]) {
    const slots = slotsFor(itemsById[id].category)
    if (slots.some((s) => claimed.has(s))) continue
    slots.forEach((s) => claimed.add(s))
    kept.add(id)
  }
  return known.filter((id) => kept.has(id))
}

const ROLE_ORDER = ['full_body', 'suit', 'outer_layer', 'mid_layer', 'base_top', 'bottom', 'footwear', 'socks', 'neckwear', 'accessory']

/** Head-to-toe order, for listing an outfit's pieces. */
export function canonicalOrder(ids, itemsById) {
  const rank = (id) => {
    const i = ROLE_ORDER.indexOf(roleOf(itemsById[id]?.category))
    return i === -1 ? ROLE_ORDER.length : i
  }
  return [...ids].sort((a, b) => rank(a) - rank(b) || ids.indexOf(a) - ids.indexOf(b))
}

/** Does this set of pieces cover the body: top + bottom, or a one-piece? */
export function isComplete(ids, itemsById) {
  const roles = new Set(ids.map((id) => roleOf(itemsById[id]?.category)))
  const covered = roles.has('full_body') || ((roles.has('base_top') || roles.has('suit')) && roles.has('bottom'))
  return covered
}

/** What the closet still needs before Claude can build a full outfit. */
export function readiness(items) {
  const roles = new Set(items.filter((i) => !i.laundry && i.category).map((i) => roleOf(i.category)))
  const missing = []
  const hasBody = roles.has('full_body') || (roles.has('base_top') && roles.has('bottom'))
  if (!hasBody) {
    if (!roles.has('base_top') && !roles.has('full_body')) missing.push('a top')
    if (!roles.has('bottom') && !roles.has('full_body')) missing.push('a bottom')
  }
  if (!roles.has('footwear')) missing.push('shoes')
  return { ready: hasBody, missing }
}

const WARM_LAYERS = new Set(['jacket', 'coat', 'blazer', 'hoodie', 'cardigan', 'sweater', 'sweatshirt', 'overshirt', 'sherwani', 'nehru-jacket'])
const HOT_WEATHER = new Set(['shorts', 'tank-top', 'sandals', 'crop-top', 'linen'])

/**
 * How well a piece suits the weather, 0–1. Warmth runs 1 (breezy) to 5
 * (heavy). Simple on purpose: it only orders the list Claude reads.
 */
export function weatherScore(item, weather) {
  const temp = weatherOf(weather).temp
  const warmth = Number(item.warmth) || 3
  const role = roleOf(item.category)
  if (role === 'accessory' || role === 'neckwear') return 1
  if (temp >= 29) {
    if (warmth >= 4 || item.category === 'coat' || item.category === 'boots') return 0.1
    if (warmth === 3) return 0.6
    return 1
  }
  if (temp >= 24) return warmth >= 5 ? 0.2 : warmth === 4 ? 0.6 : 1
  if (temp >= 18) return warmth === 1 && HOT_WEATHER.has(item.category) ? 0.6 : 1
  if (temp >= 12) return warmth <= 1 ? 0.4 : WARM_LAYERS.has(item.category) || warmth >= 3 ? 1 : 0.8
  return warmth <= 2 ? 0.25 : WARM_LAYERS.has(item.category) || warmth >= 4 ? 1 : 0.7
}

/** Clean pieces, best-suited first, recently worn ones nudged down. */
export function rankForPrompt(items, { weather, today, mustIncludeId } = {}) {
  return items
    .filter((i) => i.category && !i.laundry && i.aiStatus !== 'pending')
    .map((item) => {
      let score = weatherScore(item, weather)
      const since = item.lastWorn ? daysBetween(item.lastWorn, today) : null
      if (since !== null && since <= 2) score *= 0.6
      if (item.favorite) score *= 1.1
      if (item.id === mustIncludeId) score = 99
      return { item, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item)
}

/** One compact line per piece for the prompt. n is the number Claude uses. */
export function describeForPrompt(item, n, today) {
  const bits = [
    `#${n} ${item.name || typeLabel(item.category)}`,
    `${typeLabel(item.category)}${item.subtype ? ` (${item.subtype})` : ''}`,
    (item.colors ?? []).map(colorLabel).join(', ') || null,
    [item.pattern, item.material].filter(Boolean).join(' ') || null,
    item.fit ? `${item.fit} fit` : null,
    `formality ${item.formality ?? 2}/5`,
    `warmth ${item.warmth ?? 3}/5`,
    (item.styles ?? []).join(', ') || null,
  ]
  const since = item.lastWorn ? daysBetween(item.lastWorn, today) : null
  bits.push(item.wearCount ? `worn ${item.wearCount}×${since !== null ? `, last ${since === 0 ? 'today' : `${since}d ago`}` : ''}` : 'never worn')
  if (item.favorite) bits.push('a favourite')
  if (item.notes) bits.push(`note: ${String(item.notes).slice(0, 80)}`)
  return bits.filter(Boolean).join(' | ')
}

const DRESSING = { mens: 'menswear', womens: 'womenswear', any: 'no preference given' }

export function buildStylistPrompt({ items, plan, settings, taste, today, avoid = [], count = 3 }) {
  const ranked = rankForPrompt(items, { weather: plan.weather, today, mustIncludeId: plan.mustInclude })
  const pool = ranked.slice(0, 160)
  const numbers = new Map(pool.map((item, i) => [i + 1, item.id]))
  const lines = pool.map((item, i) => describeForPrompt(item, i + 1, today))
  const mustN = plan.mustInclude ? pool.findIndex((i) => i.id === plan.mustInclude) + 1 : 0
  const w = weatherOf(plan.weather)
  const conditions = [plan.rain && 'rain likely', plan.humid && 'humid'].filter(Boolean).join(', ')

  const about = [
    `- Dressing for: ${DRESSING[settings.dressingFor] ?? DRESSING.any}`,
    settings.styles?.length ? `- Style they like: ${settings.styles.join(', ')}` : null,
    settings.loveColors?.length ? `- Colours they love: ${settings.loveColors.map(colorLabel).join(', ')}` : null,
    settings.avoidColors?.length ? `- Colours to avoid: ${settings.avoidColors.map(colorLabel).join(', ')}` : null,
    `- Lives in: ${settings.city?.trim() || 'India'}`,
    settings.notes?.trim() ? `- About them: ${settings.notes.trim().slice(0, 400)}` : null,
  ].filter(Boolean)

  const liked = (taste?.liked ?? []).slice(-12)
  const disliked = (taste?.disliked ?? []).slice(-12)
  const tasteText = [
    liked.length ? `Liked before:\n${liked.map((t) => `- ${t.summary}`).join('\n')}` : null,
    disliked.length ? `Rejected before:\n${disliked.map((t) => `- ${t.summary}${t.reason ? ` (${t.reason})` : ''}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const avoidText = avoid.length
    ? `\nALREADY SUGGESTED (do not repeat these combinations; change at least the top or the bottom):\n${avoid
        .map((ids) => `- ${ids.map((id) => `#${[...numbers].find(([, v]) => v === id)?.[0] ?? '?'}`).join(' + ')}`)
        .join('\n')}\n`
    : ''

  const prompt = `You are a personal stylist choosing outfits from the owner's own wardrobe. Every outfit must use only pieces from the list below.

ABOUT THE OWNER
${about.join('\n')}

THE PLAN
- Occasion: ${occasionLabel(plan.occasion)}
- Weather: ${w.label}, ${w.range}C${conditions ? `, ${conditions}` : ''}
- Time: ${plan.time ?? 'day'}
${plan.brief?.trim() ? `- In their words: "${plan.brief.trim().slice(0, 300)}"` : ''}
${mustN ? `- MUST include #${mustN} in every outfit.` : ''}
${tasteText ? `\nTASTE (learned from their feedback; follow it)\n${tasteText}\n` : ''}
WARDROBE (clean pieces, best suited to the weather first)
${lines.join('\n')}
${avoidText}
HOW TO STYLE
- Each outfit is ONE top + ONE bottom + ONE pair of footwear, or ONE one-piece (dress, jumpsuit, co-ord, saree, lehenga, anarkali, suit) + footwear.
- Optional: one mid layer (cardigan, vest, Nehru jacket), one outer layer (jacket, blazer, hoodie, coat, sherwani) when the weather or the look calls for it, and up to 3 accessories that each earn their place. Never two pieces from the same slot.
- Indian wear: a kurta goes with salwar/churidar, palazzo, jeans or trousers; a kurti with leggings, palazzo or jeans; juttis or kolhapuris suit festive looks. Match the occasion's formality.
- Colour: build on neutrals with one accent, or go tonal, or use neighbouring colours. At most 3 non-neutral colours.
- Proportion: balance a relaxed piece with a fitted one; don't go oversized top and bottom.
- Weather: in heat and humidity pick breathable, light pieces (cotton, linen) and skip layers; in rain avoid suede and long hems that drag; in cold, layer so each layer still looks good.
- Prefer pieces not worn in the last couple of days, and give never-worn pieces a fair chance.
- If the wardrobe lacks something an outfit needs (for example no shoes are listed), build it anyway and name the missing piece.

Give ${count} outfits that differ in their key pieces and mood. Put the strongest first.

Write each outfit as ONE line of minified JSON and nothing else: no code fence, no numbering, no text before or after.
{"items":[3,8,15],"title":"Max five words","why":["One short reason about colour or proportion","One about the occasion or weather"],"tip":"One specific, practical styling tip","missing":""}
Use "missing" only for one piece they don't own that would finish the look; otherwise leave it empty.`

  return { prompt, numbers, poolSize: pool.length }
}

/** Pull complete JSON objects out of streamed text, one per line. */
export function parseOutfitLines(text) {
  const found = []
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-*\d.)\s]+(?=\{)/, '')
    if (!line.startsWith('{') || !line.endsWith('}')) continue
    try {
      found.push(JSON.parse(line))
    } catch {
      /* a line still being written, or not JSON */
    }
  }
  if (found.length) return found
  // Fallback: the whole reply as one JSON value ({outfits:[...]} or [...]).
  try {
    const start = text.search(/[[{]/)
    const value = JSON.parse(text.slice(start, Math.max(text.lastIndexOf('}'), text.lastIndexOf(']')) + 1))
    if (Array.isArray(value)) return value
    if (Array.isArray(value?.outfits)) return value.outfits
    if (value && typeof value === 'object') return [value]
  } catch {
    /* nothing usable */
  }
  return []
}

/** Turn Claude's numbered outfit into item ids, keeping it wearable. */
export function resolveOutfit(raw, numbers, itemsById, mustInclude) {
  const ids = (Array.isArray(raw?.items) ? raw.items : [])
    .map((n) => numbers.get(Number(String(n).replace('#', ''))))
    .filter(Boolean)
  if (mustInclude && itemsById[mustInclude] && !ids.includes(mustInclude)) ids.unshift(mustInclude)
  const kept = dedupeBySlot(ids, itemsById, mustInclude ? [mustInclude] : [])
  if (kept.length < 2) return null
  const clean = (s, max) => String(s ?? '').trim().slice(0, max)
  return {
    itemIds: canonicalOrder(kept, itemsById),
    title: clean(raw.title, 60) || 'Your look',
    why: (Array.isArray(raw.why) ? raw.why : []).map((s) => clean(s, 200)).filter(Boolean).slice(0, 3),
    tip: clean(raw.tip, 240),
    missing: clean(raw.missing, 120),
    complete: isComplete(kept, itemsById),
  }
}

/** The same set of pieces, in any order. */
export const sameOutfit = (a, b) => a.length === b.length && a.every((id) => b.includes(id))

/** A short text summary of an outfit, used to remember feedback. */
export function summarizeOutfit(itemIds, itemsById) {
  return itemIds
    .map((id) => itemsById[id])
    .filter(Boolean)
    .map((i) => i.name || `${(i.colors ?? [])[0] ?? ''} ${typeLabel(i.category)}`.trim())
    .join(' + ')
}

const WASHABLE_ACCESSORIES = new Set(['dupatta', 'scarf', 'socks'])

/** Shoes, bags and watches never go in the laundry basket. */
export function washable(category) {
  const role = roleOf(category)
  if (WASHABLE_ACCESSORIES.has(category)) return true
  return !['footwear', 'accessory', 'neckwear'].includes(role)
}

/** A piece's wear counters after one more wear; it goes to the laundry when due. */
export function afterWear(item) {
  const wears = (item.wearsSinceWash ?? 0) + 1
  return { wearsSinceWash: wears, laundry: washable(item.category) && wears >= typeOf(item.category).wash }
}
