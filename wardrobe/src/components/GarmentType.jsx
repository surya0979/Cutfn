// A piece without a photo: its type, set in Impact, on a block of its own colour.
// No icons, no drawings: brutalist pieces say what they are.

import { COLOR_BY_VALUE, typeLabel } from '../lib/vocab.js'

/** Relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export default function GarmentType({ category, color, className = '', textClassName = 'text-[clamp(22px,7cqw,44px)]' }) {
  const hex = COLOR_BY_VALUE[color]?.hex
  const solid = hex && hex.startsWith('#')
  const bg = solid ? hex : '#dcd7cb'
  const fg = solid && luminance(hex) < 0.35 ? '#f0ebe0' : '#0a0a0a'
  const word = category ? typeLabel(category).split(' / ')[0] : 'Untagged'
  return (
    <div className={`flex items-end overflow-hidden p-2 [container-type:inline-size] ${className}`} style={{ background: bg, color: fg }}>
      <span className={`display break-words ${textClassName}`}>{word}</span>
    </div>
  )
}
