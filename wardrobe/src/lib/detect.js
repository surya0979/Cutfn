// Reading Claude's answer for one photo: which pieces it saw, and where.
// Boxes come back as [left, top, right, bottom] on a 0-1000 grid and are kept
// as fractions of the photo ({ x, y, w, h }). Nothing here touches the DOM.

export const MAX_PIECES = 6
// A cut is at least this much of the photo on each side: a belt or a side-on shoe is thin, not missing.
const MIN_SIDE = 0.08
// Below this a box is a point or a line, not a place.
const DEGENERATE = 0.01
const SAME_SPOT = 0.6

const clamp01 = (n) => Math.min(1, Math.max(0, n))

/** Widen [a, z] around its middle to at least `min`, staying inside 0..1. */
function atLeast(a, z, min) {
  if (z - a >= min) return [a, z]
  const mid = Math.min(1 - min / 2, Math.max(min / 2, (a + z) / 2))
  return [mid - min / 2, mid + min / 2]
}

/** [l, t, r, b] on a 0-1000 grid (or as fractions) → { x, y, w, h }, or null if unusable. */
export function readBox(raw) {
  if (!Array.isArray(raw) || raw.length !== 4) return null
  const nums = raw.map(Number)
  if (!nums.every(Number.isFinite)) return null
  const scale = nums.every((n) => n >= 0 && n <= 1) ? 1 : 1000
  let [l, t, r, b] = nums.map((n) => clamp01(n / scale))
  if (l > r) [l, r] = [r, l]
  if (t > b) [t, b] = [b, t]
  if (r - l < DEGENERATE || b - t < DEGENERATE) return null
  ;[l, r] = atLeast(l, r, MIN_SIDE)
  ;[t, b] = atLeast(t, b, MIN_SIDE)
  return { x: l, y: t, w: r - l, h: b - t }
}

/** The box grown by `pad` (a fraction of its own size) on every side, kept inside the photo. */
export function padBox(box, pad = 0.08) {
  const dx = box.w * pad
  const dy = box.h * pad
  const x = clamp01(box.x - dx)
  const y = clamp01(box.y - dy)
  return { x, y, w: clamp01(box.x + box.w + dx) - x, h: clamp01(box.y + box.h + dy) - y }
}

/** Intersection over union of two boxes. */
export function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (w <= 0 || h <= 0) return 0
  const inter = w * h
  return inter / (a.w * a.h + b.w * b.h - inter)
}

/** The list of pieces in Claude's answer, whatever shape it came back in. */
export function rawPieces(answer) {
  if (Array.isArray(answer)) return answer
  if (Array.isArray(answer?.items)) return answer.items
  if (answer && typeof answer === 'object' && 'category' in answer) return [answer]
  return []
}

/**
 * Decide how to file one photo. `pieces` is [{ tags, box }] in Claude's order
 * (main piece first). Splitting is only trusted when every piece has a usable
 * box; the same kind of piece listed twice over the same spot counts once (a
 * shirt under a jacket is two pieces). Anything doubtful stays one piece on the
 * whole photo, which the owner can always fix by hand.
 * Returns null (nothing seen), { split: false, piece } or { split: true, pieces }.
 */
export function planPieces(pieces, { several = true } = {}) {
  if (!pieces.length) return null
  const single = { split: false, piece: pieces[0] }
  if (!several || pieces.length < 2) return single
  const kept = []
  for (const p of pieces.slice(0, MAX_PIECES)) {
    if (!p.box) return single
    if (kept.some((k) => k.tags.category === p.tags.category && overlap(k.box, p.box) > SAME_SPOT)) continue
    kept.push(p)
  }
  return kept.length < 2 ? single : { split: true, pieces: kept }
}
