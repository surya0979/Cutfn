// Meal sections, in the order a school day runs.
export const SECTIONS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'morning', label: 'Morning snack' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'evening', label: 'Evening snack' },
  { id: 'dinner', label: 'Dinner' },
]

export const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label]))

/** The section a meal eaten at this time most likely belongs to. */
export function sectionForTime(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60
  if (h < 9.5) return 'breakfast'
  if (h < 12) return 'morning'
  if (h < 15) return 'lunch'
  if (h < 19) return 'evening'
  return 'dinner'
}

/** Older entries have no section; infer one from when they were logged. */
export const sectionOf = (meal) => meal.section ?? sectionForTime(new Date(meal.createdAt ?? Date.now()))
