import { describe, expect, it } from 'vitest'
import { SCHOOL_MENUS, withSchoolMenus } from './schoolMenus.js'
import { menuFoods, menuForDate } from './weeklyMenu.js'

describe('built-in school menus', () => {
  it('has three full-day weeks', () => {
    expect(SCHOOL_MENUS.map((m) => [m.week, m.weekStart])).toEqual([
      [1, '2026-10-05'],
      [2, '2026-10-12'],
      [3, '2026-10-26'],
    ])
    const tuesday = menuForDate(SCHOOL_MENUS, '2026-10-06').entries
    expect(new Set(tuesday.map((e) => e.section))).toEqual(new Set(['breakfast', 'morning', 'lunch', 'evening', 'dinner']))
    expect(tuesday.map((e) => e.text)).toEqual(expect.arrayContaining(['ALOO PARATHA', 'SUBZI KADHI', 'PANEER BHURJI', 'CHICKEN BURGER']))
  })

  it('knows every dish on every day', () => {
    for (const week of SCHOOL_MENUS) {
      for (const day of Object.values(week.days)) expect(menuFoods(day).unknown).toEqual([])
    }
  })

  it('marks the Friday lunch and Wednesday dinner specials', () => {
    const fri = menuForDate(SCHOOL_MENUS, '2026-10-16').entries
    expect(menuFoods(fri).special.map((e) => e.text)).toEqual(['INTERNATIONAL LUNCH SERIES - PORTUGUESE SPECIAL LUNCH'])
    const wed = menuForDate(SCHOOL_MENUS, '2026-10-07').entries
    expect(wed.filter((e) => e.section === 'dinner').map((e) => e.text)).toEqual(['WEDNESDAY SPECIAL DINNER'])
  })

  it('carries the 3-week cycle on past the gap and the last week', () => {
    expect(menuForDate(SCHOOL_MENUS, '2026-10-21')).toMatchObject({
      repeated: true,
      menu: { week: 3 },
    })
    expect(menuForDate(SCHOOL_MENUS, '2026-11-02')).toMatchObject({
      repeated: true,
      menu: { week: 1 },
    })
    expect(menuForDate(SCHOOL_MENUS, '2026-11-16').menu.week).toBe(3)
    expect(menuForDate(SCHOOL_MENUS, '2026-09-30')).toBeNull()
  })

  it('lets an uploaded week replace the built-in one and keeps older uploads', () => {
    const upload = { weekStart: '2026-10-05', week: 1, days: { 0: [] } }
    const old = { weekStart: '2026-09-14', week: 1, days: { 0: [] } }
    const all = withSchoolMenus([upload, old])
    expect(all.filter((m) => m.weekStart === '2026-10-05')).toEqual([upload])
    expect(menuForDate(all, '2026-09-21')).toMatchObject({
      repeated: true,
      menu: { week: 2, builtin: true },
    })
  })
})
