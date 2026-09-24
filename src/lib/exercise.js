// Calorie burn from the standard MET equation:
//
//   kcal = MET × body weight (kg) × duration (hours)
//
// MET values come from the 2011 Compendium of Physical Activities
// (Ainsworth et al.). Weight is always the most recent weigh-in, so the same
// run burns more for a heavier person and the estimate drops as the cut works.

import { kmToMi } from './units.js'

// [speed in mph, MET] pairs; values between rows are linearly interpolated.
export const WALKING_METS = [
  [1.5, 2.0], // strolling, very slow
  [2.0, 2.8],
  [2.5, 3.0],
  [3.0, 3.5], // moderate pace
  [3.5, 4.3], // brisk
  [4.0, 5.0],
  [4.5, 7.0], // very brisk
  [5.0, 8.3],
]

export const RUNNING_METS = [
  [4.0, 6.0], // 15:00 /mi
  [5.0, 8.3], // 12:00 /mi
  [5.2, 9.0],
  [6.0, 9.8], // 10:00 /mi
  [6.7, 10.5],
  [7.0, 11.0],
  [7.5, 11.5], // 8:00 /mi
  [8.0, 11.8],
  [8.6, 12.3], // 7:00 /mi
  [9.0, 12.8],
  [10.0, 14.5], // 6:00 /mi
  [11.0, 16.0],
  [12.0, 19.0],
  [13.0, 19.8],
  [14.0, 23.0],
]

/** Pace assumed when no time is entered. */
export const DEFAULT_SPEED_MPH = { walk: 3.0, run: 6.0 }

// Rope jumping, 2011 Compendium codes 15551/15552/15560.
export const JUMP_ROPE = {
  slow: { label: 'Slow', detail: '< 100 skips/min', met: 8.8, skipsPerMin: 90 },
  moderate: { label: 'Moderate', detail: '100–120 skips/min', met: 11.8, skipsPerMin: 110 },
  fast: { label: 'Fast', detail: '120–160 skips/min', met: 12.3, skipsPerMin: 140 },
}

// Timed sports and training (2011 Compendium codes 15605/15610, 02050/02054/02052).
export const TIMED_ACTIVITIES = {
  football: {
    label: 'Football',
    levels: {
      light: { label: 'Kickabout', detail: 'casual, lots of standing', met: 7.0 },
      moderate: { label: 'Game', detail: 'regular match play', met: 8.5 },
      hard: { label: 'Competitive', detail: 'full-intensity match', met: 10.0 },
    },
  },
  gym: {
    label: 'Gym',
    levels: {
      light: { label: 'Light', detail: 'machines, long rests', met: 3.5 },
      moderate: { label: 'Moderate', detail: 'free weights, normal rests', met: 5.0 },
      hard: { label: 'Hard', detail: 'heavy lifts or circuits', met: 6.0 },
    },
  },
}

/** Football or gym for a number of minutes at an intensity. */
export function timedBurn({ kind, minutes, level = 'moderate', weightKg }) {
  const preset = TIMED_ACTIVITIES[kind]?.levels[level] ?? TIMED_ACTIVITIES[kind]?.levels.moderate
  if (!preset || !(minutes > 0) || !(weightKg > 0)) return null
  return { met: preset.met, minutes, kcal: kcalFromMet(preset.met, weightKg, minutes) }
}

export function interpolateMet(table, speedMph) {
  if (speedMph <= table[0][0]) return table[0][1]
  const last = table[table.length - 1]
  if (speedMph >= last[0]) return last[1]
  for (let i = 1; i < table.length; i++) {
    const [s1, m1] = table[i]
    if (speedMph <= s1) {
      const [s0, m0] = table[i - 1]
      return m0 + ((m1 - m0) * (speedMph - s0)) / (s1 - s0)
    }
  }
  return last[1]
}

export const kcalFromMet = (met, weightKg, minutes) => met * weightKg * (minutes / 60)

/**
 * Walking or running over a distance. With a duration the actual speed picks
 * the MET; without one the typical pace for that activity is assumed.
 */
export function distanceBurn({ activity, distanceKm, durationMin, weightKg }) {
  const miles = kmToMi(distanceKm)
  if (!(miles > 0) || !(weightKg > 0)) return null
  const hasTime = durationMin > 0
  const speedMph = hasTime ? miles / (durationMin / 60) : DEFAULT_SPEED_MPH[activity]
  const table = activity === 'run' ? RUNNING_METS : WALKING_METS
  const met = interpolateMet(table, speedMph)
  const minutes = hasTime ? durationMin : (miles / speedMph) * 60
  const [minSpeed, maxSpeed] = [table[0][0], table[table.length - 1][0]]
  return {
    met,
    minutes,
    speedMph,
    assumedPace: !hasTime,
    outOfRange: speedMph < minSpeed * 0.75 || speedMph > maxSpeed * 1.1,
    kcal: kcalFromMet(met, weightKg, minutes),
  }
}

/** Jump rope from either a skip count or minutes, at a given intensity. */
export function jumpRopeBurn({ mode, skips, minutes, intensity = 'moderate', weightKg }) {
  const preset = JUMP_ROPE[intensity] ?? JUMP_ROPE.moderate
  const duration = mode === 'skips' ? skips / preset.skipsPerMin : minutes
  if (!(duration > 0) || !(weightKg > 0)) return null
  return {
    met: preset.met,
    minutes: duration,
    skips: mode === 'skips' ? skips : Math.round(duration * preset.skipsPerMin),
    kcal: kcalFromMet(preset.met, weightKg, duration),
  }
}

/** Recompute a stored exercise entry against a body weight. */
export function exerciseBurn(entry, weightKg) {
  if (TIMED_ACTIVITIES[entry.kind]) {
    return timedBurn({ ...entry, weightKg })
  }
  if (entry.kind === 'jumprope') {
    return jumpRopeBurn({ ...entry, weightKg })
  }
  return distanceBurn({
    activity: entry.kind,
    distanceKm: entry.distanceKm,
    durationMin: entry.durationMin,
    weightKg,
  })
}

/** "9:58" style pace string for a speed in mph (per mile) or converted per km. */
export function formatPace(speedMph, unit = 'mi') {
  if (!(speedMph > 0)) return '–'
  const minPerMile = 60 / speedMph
  const minPerUnit = unit === 'km' ? minPerMile / 1.609344 : minPerMile
  let whole = Math.floor(minPerUnit)
  let secs = Math.round((minPerUnit - whole) * 60)
  if (secs === 60) {
    whole += 1
    secs = 0
  }
  return `${whole}:${String(secs).padStart(2, '0')} /${unit}`
}
