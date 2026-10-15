import { describe, expect, it } from 'vitest'
import { combineItems } from './aiEstimate.js'

describe('combining a split dish', () => {
  const parts = [
    { name: 'Maggi noodles', portion: '1 pack', kcal: 350, protein: 8, carbs: 48, fat: 14 },
    { name: 'Egg', portion: '1 egg', kcal: 78, protein: 6, carbs: 1, fat: 5 },
    { name: 'Cheese slice', portion: '1 slice', kcal: 62, protein: 4, carbs: 1, fat: 5 },
  ]

  it('adds up calories and macros under the name that was typed', () => {
    expect(combineItems(parts, 'maggi with egg and cheese')).toMatchObject({
      name: 'Maggi with egg and cheese',
      portion: '1 serving',
      kcal: 490,
      protein: 18,
      carbs: 50,
      fat: 24,
    })
  })

  it('keeps what it was made of and falls back to the part names', () => {
    const merged = combineItems(parts, '  ')
    expect(merged.name).toBe('Maggi noodles + Egg + Cheese slice')
    expect(merged.assumption).toContain('Egg (1 egg) 78 kcal')
  })
})
