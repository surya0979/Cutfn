import { describe, expect, it } from 'vitest'
import { cleanTags, readTagAnswer, tagPrompt } from './ai.js'
import { overlap, padBox, planPieces, rawPieces, readBox } from './detect.js'

const tee = { name: 'White tee', category: 't-shirt', colors: ['white'], box: [50, 40, 480, 520] }
const jeans = { name: 'Blue jeans', category: 'jeans', colors: ['denim'], box: [520, 60, 960, 940] }
const shoes = { name: 'White sneakers', category: 'sneakers', colors: ['white'], box: [60, 620, 470, 900] }

describe('readBox', () => {
  it('reads a 0-1000 box as fractions', () => {
    expect(readBox([100, 200, 600, 900])).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.7 })
  })
  it('accepts fractions and swapped corners, and clamps to the photo', () => {
    expect(readBox([0.6, 0.9, 0.1, 0.2])).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.7 })
    expect(readBox([-50, 0, 1200, 500])).toEqual({ x: 0, y: 0, w: 1, h: 0.5 })
  })
  it('rejects missing, malformed and sliver boxes', () => {
    expect(readBox(undefined)).toBeNull()
    expect(readBox([1, 2, 3])).toBeNull()
    expect(readBox(['a', 0, 10, 10])).toBeNull()
    expect(readBox([100, 100, 120, 900])).toBeNull()
  })
})

describe('padBox and overlap', () => {
  it('grows a box but keeps it inside the photo', () => {
    const p = padBox({ x: 0.02, y: 0.5, w: 0.5, h: 0.5 }, 0.1)
    expect(p.x).toBe(0)
    expect(p.y).toBeCloseTo(0.45)
    expect(p.y + p.h).toBe(1)
    expect(p.w).toBeCloseTo(0.57)
  })
  it('measures how much two boxes cover the same spot', () => {
    const a = { x: 0, y: 0, w: 0.5, h: 0.5 }
    expect(overlap(a, a)).toBe(1)
    expect(overlap(a, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 })).toBe(0)
    expect(overlap(a, { x: 0.25, y: 0, w: 0.5, h: 0.5 })).toBeCloseTo(1 / 3)
  })
})

describe('rawPieces', () => {
  it('takes the list in any shape Claude answers with', () => {
    expect(rawPieces({ items: [tee, jeans] })).toHaveLength(2)
    expect(rawPieces([tee])).toHaveLength(1)
    expect(rawPieces(tee)).toEqual([tee])
    expect(rawPieces({ items: [], reason: 'a cat' })).toEqual([])
    expect(rawPieces(null)).toEqual([])
  })
})

describe('readTagAnswer', () => {
  it('splits a flat-lay into one piece each, in Claude’s order', () => {
    const plan = readTagAnswer({ items: [tee, jeans, shoes] })
    expect(plan.split).toBe(true)
    expect(plan.pieces.map((p) => p.tags.category)).toEqual(['t-shirt', 'jeans', 'sneakers'])
    expect(plan.pieces[1].tags.colors).toEqual(['indigo'])
    const box = plan.pieces[0].box
    expect([box.x, box.y, box.w, box.h].map((n) => Math.round(n * 1000))).toEqual([50, 40, 430, 480])
  })
  it('keeps a single piece on the whole photo', () => {
    const plan = readTagAnswer({ items: [tee] })
    expect(plan).toMatchObject({ split: false, piece: { tags: { category: 't-shirt' } } })
  })
  it('answers in the old one-object shape still work', () => {
    expect(readTagAnswer({ name: 'Grey hoodie', category: 'hoodie', colors: ['grey'] })).toMatchObject({ split: false, piece: { tags: { colors: ['gray'] } } })
  })
  it('takes only the main piece when splitting is off', () => {
    const plan = readTagAnswer({ items: [jeans, tee] }, { several: false })
    expect(plan).toMatchObject({ split: false, piece: { tags: { category: 'jeans' } } })
  })
  it('does not split when any box is missing or unusable', () => {
    expect(readTagAnswer({ items: [tee, { ...jeans, box: null }] }).split).toBe(false)
    expect(readTagAnswer({ items: [tee, { ...jeans, box: [5, 5, 6, 6] }] }).split).toBe(false)
  })
  it('counts the same piece listed twice once, but keeps layers', () => {
    const twice = readTagAnswer({ items: [tee, { ...tee, name: 'Cream tee', box: [60, 50, 470, 530] }] })
    expect(twice.split).toBe(false)
    const layered = readTagAnswer({ items: [{ ...tee, category: 'jacket' }, tee] })
    expect(layered.split).toBe(true)
  })
  it('drops pieces that aren’t clothing and returns null when nothing is', () => {
    const plan = readTagAnswer({ items: [{ category: 'sofa', box: [0, 0, 500, 500] }, tee] })
    expect(plan).toMatchObject({ split: false, piece: { tags: { category: 't-shirt' } } })
    expect(readTagAnswer({ items: [], reason: 'a cat' })).toBeNull()
  })
  it('caps a busy photo at six pieces', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ category: 'socks', name: `Socks ${i}`, box: [i * 100, 0, i * 100 + 90, 200] }))
    expect(readTagAnswer({ items: many }).pieces).toHaveLength(6)
  })
})

describe('tagging', () => {
  it('leaves colours empty instead of guessing', () => {
    expect(cleanTags({ category: 'shirt', colors: ['neon-ish'] }).colors).toEqual([])
  })
  it('asks for every piece, or just the main one', () => {
    expect(tagPrompt()).toMatch(/List every separate piece/)
    expect(tagPrompt({ several: false })).toMatch(/MAIN piece only/)
    expect(tagPrompt()).toMatch(/"box"/)
  })
  it('plans directly from tagged pieces too', () => {
    expect(planPieces([])).toBeNull()
  })
})
