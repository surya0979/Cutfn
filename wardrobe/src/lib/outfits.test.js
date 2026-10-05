import { describe, expect, it } from 'vitest'
import { afterWear, buildStylistPrompt, canonicalOrder, dedupeBySlot, isComplete, parseOutfitLines, readiness, resolveOutfit, weatherScore } from './outfits.js'
import { cleanTags } from './ai.js'
import { DEFAULT_SETTINGS } from './vocab.js'

const piece = (id, category, extra = {}) => ({ id, category, name: `${id} ${category}`, colors: ['navy'], formality: 2, warmth: 2, ...extra })
const closet = [
  piece('tee', 't-shirt'),
  piece('shirt', 'shirt'),
  piece('jeans', 'jeans', { warmth: 3 }),
  piece('chinos', 'pants'),
  piece('dress', 'dress'),
  piece('sneakers', 'sneakers'),
  piece('loafers', 'shoes'),
  piece('coat', 'coat', { warmth: 5 }),
  piece('watch', 'watch'),
  piece('bag1', 'bag'),
  piece('bag2', 'bag'),
  piece('kurta', 'kurta'),
  piece('salwar', 'salwar'),
]
const byId = Object.fromEntries(closet.map((i) => [i.id, i]))

describe('dedupeBySlot', () => {
  it('keeps one piece per body slot', () => {
    expect(dedupeBySlot(['tee', 'shirt', 'jeans', 'chinos', 'sneakers'], byId)).toEqual(['tee', 'jeans', 'sneakers'])
  })
  it('lets a dress replace separates wherever it appears', () => {
    expect(dedupeBySlot(['tee', 'jeans', 'dress', 'sneakers'], byId)).toEqual(['dress', 'sneakers'])
  })
  it('keeps a mandatory piece over others in its slot', () => {
    expect(dedupeBySlot(['tee', 'jeans', 'shirt'], byId, ['shirt'])).toEqual(['jeans', 'shirt'])
  })
  it('allows several accessories but not two of a kind', () => {
    expect(dedupeBySlot(['tee', 'jeans', 'watch', 'bag1', 'bag2'], byId)).toEqual(['tee', 'jeans', 'watch', 'bag1'])
  })
  it('drops unknown ids and duplicates', () => {
    expect(dedupeBySlot(['tee', 'tee', 'nope', 'jeans'], byId)).toEqual(['tee', 'jeans'])
  })
})

describe('outfit shape', () => {
  it('orders head to toe', () => {
    expect(canonicalOrder(['sneakers', 'jeans', 'coat', 'tee', 'watch'], byId)).toEqual(['coat', 'tee', 'jeans', 'sneakers', 'watch'])
  })
  it('knows a full outfit', () => {
    expect(isComplete(['tee', 'jeans'], byId)).toBe(true)
    expect(isComplete(['kurta', 'salwar'], byId)).toBe(true)
    expect(isComplete(['dress', 'sneakers'], byId)).toBe(true)
    expect(isComplete(['tee', 'sneakers'], byId)).toBe(false)
  })
  it('says what the closet is missing', () => {
    expect(readiness([piece('a', 't-shirt')])).toEqual({ ready: false, missing: ['a bottom', 'shoes'] })
    expect(readiness(closet).ready).toBe(true)
    expect(readiness([piece('d', 'dress', { laundry: true }), piece('s', 'sneakers')]).ready).toBe(false)
  })
})

describe('weatherScore', () => {
  it('keeps heavy layers out of the heat and light pieces out of the cold', () => {
    expect(weatherScore(byId.coat, 'hot')).toBeLessThan(0.3)
    expect(weatherScore(byId.tee, 'hot')).toBe(1)
    expect(weatherScore(byId.coat, 'cold')).toBe(1)
    expect(weatherScore(piece('s', 'shorts', { warmth: 1 }), 'cold')).toBeLessThan(0.5)
  })
})

describe('laundry', () => {
  it('sends a t-shirt to the wash after one wear, jeans after six', () => {
    expect(afterWear(byId.tee)).toEqual({ wearsSinceWash: 1, laundry: true })
    expect(afterWear({ ...byId.jeans, wearsSinceWash: 4 })).toEqual({ wearsSinceWash: 5, laundry: false })
    expect(afterWear({ ...byId.jeans, wearsSinceWash: 5 }).laundry).toBe(true)
  })
  it('never puts shoes or watches in the laundry', () => {
    expect(afterWear({ ...byId.sneakers, wearsSinceWash: 99 }).laundry).toBe(false)
    expect(afterWear({ ...byId.watch, wearsSinceWash: 99 }).laundry).toBe(false)
  })
})

describe('stylist prompt and replies', () => {
  const plan = { occasion: 'hangout', weather: 'hot', time: 'evening', brief: '', mustInclude: null }
  const { prompt, numbers } = buildStylistPrompt({ items: closet, plan, settings: DEFAULT_SETTINGS, taste: null, today: '2026-10-05' })

  it('numbers every clean piece and puts heavy layers last in the heat', () => {
    expect(numbers.size).toBe(closet.length)
    expect(numbers.get(numbers.size)).toBe('coat')
    expect(prompt).toContain('Occasion: Hangout')
    expect(prompt).toContain('Hot, 29–34°C')
  })

  it('reads one outfit per line while streaming, ignoring half-written lines', () => {
    const text = 'Sure!\n{"items":[1,2],"title":"A"}\n{"items":[3,4],"title":"B"}\n{"items":[5'
    expect(parseOutfitLines(text).map((o) => o.title)).toEqual(['A', 'B'])
  })

  it('falls back to a JSON array or {outfits:[]} reply', () => {
    expect(parseOutfitLines('```json\n[{"items":[1]},{"items":[2]}]\n```')).toHaveLength(2)
    expect(parseOutfitLines('{"outfits":[{"items":[1]}]}')).toHaveLength(1)
  })

  it('maps numbers back to pieces and keeps the outfit wearable', () => {
    const n = (id) => [...numbers].find(([, v]) => v === id)[0]
    const o = resolveOutfit({ items: [n('tee'), n('shirt'), n('jeans'), n('sneakers'), 999], title: 'Easy', why: ['x'] }, numbers, byId)
    expect(o.itemIds).toEqual(['tee', 'jeans', 'sneakers'])
    expect(o.complete).toBe(true)
  })

  it('adds a required piece Claude forgot', () => {
    const n = (id) => [...numbers].find(([, v]) => v === id)[0]
    const o = resolveOutfit({ items: [n('tee'), n('jeans')] }, numbers, byId, 'loafers')
    expect(o.itemIds).toEqual(['tee', 'jeans', 'loafers'])
  })
})

describe('cleanTags', () => {
  it('keeps known values and fixes common spellings', () => {
    const t = cleanTags({ name: 'Grey hoodie', category: 'hoodie', colors: ['Grey', 'neon'], pattern: 'solid', material: 'fleece', formality: 9, warmth: '4', styles: ['streetwear', 'goth'] })
    expect(t).toMatchObject({ category: 'hoodie', colors: ['gray'], material: 'fleece', formality: 5, warmth: 4, styles: ['streetwear'] })
  })
  it('rejects photos with no clothing', () => {
    expect(cleanTags({ category: null, reason: 'a cat' })).toBeNull()
  })
})
