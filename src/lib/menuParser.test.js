import { describe, expect, it } from 'vitest'
import { FOOD_DB } from './foodDb.js'
import { editDistance, matchLine, normalize, parseMenu, SAMPLE_MENU } from './menuParser.js'

const ids = (line) => matchLine(line).map((m) => m.food.id)

describe('normalize', () => {
  it('handles menu shorthand', () => {
    expect(normalize('Mac & Cheese w/ Broccoli')).toBe('mac and cheese with broccoli')
    expect(normalize("Chef's Salad — $3.25")).toBe('chefs salad 3 25')
  })
})

describe('matchLine', () => {
  it('prefers the most specific alias', () => {
    expect(ids('Chicken Caesar Salad')).toEqual(['chicken-caesar'])
    expect(ids('Orange Chicken')).toEqual(['orange-chicken'])
    expect(ids('Mac and Cheese')).toEqual(['mac-cheese'])
    expect(ids('Grilled Cheese')).toEqual(['grilled-cheese'])
  })

  it('finds several foods on one line', () => {
    expect(ids('Cheeseburger w/ Fries & Chocolate Milk')).toEqual(['cheeseburger', 'fries', 'choc-milk'])
    expect(ids('Beef Tacos with Spanish Rice and Refried Beans')).toEqual(['tacos', 'spanish-rice', 'refried-beans'])
  })

  it('tolerates plurals and OCR typos', () => {
    expect(ids('Chiken Nugets')).toEqual(['nuggets'])
    expect(ids('Pizzas')).toEqual(['cheese-pizza'])
    expect(matchLine('Chiken Nugets')[0].fuzzy).toBe(true)
  })

  it('does not fuzzy-match calendar words', () => {
    expect(ids('No School - Spring Break')).toEqual([])
  })
})

describe('parseMenu', () => {
  it('parses the sample menu into unique foods and leftovers', () => {
    const { items, unmatched } = parseMenu(SAMPLE_MENU)
    const found = items.map((i) => i.food.id)
    for (const id of ['paneer-butter-masala', 'dal-makhani', 'chapati', 'rajma', 'jeera-rice', 'kadhi', 'beef-burrito', 'coconut-water', 'curd']) {
      expect(found).toContain(id)
    }
    expect(new Set(found).size).toBe(found.length)
    expect(unmatched).toEqual([])
  })

  it('counts repeats instead of duplicating rows', () => {
    const { items } = parseMenu('Milk\nMilk\nPizza')
    expect(items.find((i) => i.food.id === 'milk').count).toBe(2)
  })
})

it('computes edit distance', () => {
  expect(editDistance('nuggets', 'nugets')).toBe(1)
  expect(editDistance('kitten', 'sitting')).toBe(3)
})

describe('Indian school menu', () => {
  it('matches canteen dishes without swallowing longer names', () => {
    expect(ids('Paneer Tikka Masala')).toEqual(['paneer-butter-masala'])
    expect(ids('DAL Makhni')).toEqual(['dal-makhani'])
    expect(ids('Chole Masala')).toEqual(['chole'])
    expect(ids('Vada Pav and Dal Tadka')).toEqual(['vada-pav', 'dal'])
    expect(ids('Kung Pao Tofu')).toEqual(['kung-pao-tofu'])
    expect(ids('WATERMELON & LEMON SARBATH')).toEqual(['lemon-drink'])
    expect(ids('Paper boat coconut water 100 ml')).toEqual(['coconut-water'])
    expect(ids('COLUMBIAN COFFEE CAKE')).toEqual(['cake'])
  })
})

describe('food database', () => {
  it('has unique ids', () => {
    expect(new Set(FOOD_DB.map((f) => f.id)).size).toBe(FOOD_DB.length)
  })

  it('has macros that roughly add up to the calories (4/4/9)', () => {
    for (const f of FOOD_DB) {
      if (f.kcal < 40) continue
      const fromMacros = f.p * 4 + f.c * 4 + f.f * 9
      expect(Math.abs(fromMacros - f.kcal) / f.kcal, f.name).toBeLessThan(0.15)
    }
  })
})
