// Flat silhouettes of garments, tinted with the piece's colour. Used where a
// photo is missing or still on its way, and in the empty closet.

import { COLOR_BY_VALUE } from '../lib/vocab.js'

const P = {
  tee: 'M22 10 L28 8 Q32 12 36 8 L42 10 L54 18 L49 27 L44 24 L44 56 L20 56 L20 24 L15 27 L10 18 Z',
  long: 'M22 10 L28 8 Q32 12 36 8 L42 10 L50 16 L56 46 L50 47 L44 26 L44 56 L20 56 L20 26 L14 47 L8 46 L14 16 Z',
  tunic: 'M23 7 L28 6 Q32 10 36 6 L41 7 L49 13 L55 40 L49 41 L44 22 L46 60 L18 60 L20 22 L15 41 L9 40 L15 13 Z',
  tank: 'M24 8 L28 8 Q32 16 36 8 L40 8 L42 22 L44 56 L20 56 L22 22 Z',
  pants: 'M20 8 L44 8 L47 58 L36 58 L32 24 L28 58 L17 58 Z',
  shorts: 'M19 14 L45 14 L48 42 L35 42 L32 28 L29 42 L16 42 Z',
  skirt: 'M23 12 L41 12 L50 52 L14 52 Z',
  dress: 'M25 6 L29 6 Q32 10 35 6 L39 6 L40 18 L38 24 L50 58 L14 58 L26 24 L24 18 Z',
  jumpsuit: 'M25 6 L29 6 Q32 9 35 6 L39 6 L40 20 L44 58 L35 58 L32 34 L29 58 L20 58 L24 20 Z',
  shoe: 'M8 40 Q8 30 16 30 L26 30 Q30 36 38 37 L52 40 Q57 41 57 46 L57 50 L8 50 Z',
  bag: 'M16 26 L48 26 L52 56 L12 56 Z',
  cap: 'M12 40 Q14 22 32 22 Q50 22 52 40 Z M8 40 L56 40 L56 44 L8 44 Z',
  tie: 'M28 8 L36 8 L34 14 L40 46 L32 56 L24 46 L30 14 Z',
  belt: 'M6 28 L58 28 L58 36 L6 36 Z',
  scarf: 'M10 20 Q20 14 32 20 T54 20 L54 30 Q44 24 32 30 T10 30 Z M40 30 L46 54 L38 54 L34 30 Z',
  round: 'M32 20 A12 12 0 1 1 31.99 20 Z M27 6 L37 6 L37 20 L27 20 Z M27 44 L37 44 L37 58 L27 58 Z',
}

const SHAPE = {
  't-shirt': 'tee', polo: 'tee', top: 'tee', 'crop-top': 'tee', blouse: 'tee',
  shirt: 'long', sweater: 'long', sweatshirt: 'long', hoodie: 'long', jacket: 'long', overshirt: 'long', blazer: 'long', coat: 'long', cardigan: 'long', sherwani: 'tunic',
  kurta: 'tunic', kurti: 'tunic', 'nehru-jacket': 'tank', vest: 'tank', 'tank-top': 'tank',
  jeans: 'pants', pants: 'pants', joggers: 'pants', leggings: 'pants', salwar: 'pants', palazzo: 'pants', dhoti: 'pants',
  shorts: 'shorts', skirt: 'skirt',
  dress: 'dress', saree: 'dress', lehenga: 'dress', anarkali: 'dress', 'co-ord': 'jumpsuit', jumpsuit: 'jumpsuit', suit: 'long',
  sneakers: 'shoe', shoes: 'shoe', boots: 'shoe', sandals: 'shoe', heels: 'shoe', flats: 'shoe', juttis: 'shoe',
  bag: 'bag', hat: 'cap', tie: 'tie', belt: 'belt', scarf: 'scarf', dupatta: 'scarf', socks: 'shoe',
}

// A gradient can't fill an SVG path; multicolour falls back to a mid tone.
const fillFor = (color) => {
  const hex = COLOR_BY_VALUE[color]?.hex
  return hex && hex.startsWith('#') ? hex : '#8a7fb0'
}

export default function GarmentGlyph({ category, color, className = '' }) {
  const d = P[SHAPE[category] ?? 'round']
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d={d} fill={fillFor(color)} stroke="var(--ink)" strokeOpacity="0.28" strokeWidth="1.2" strokeLinejoin="round" fillRule="evenodd" />
      {SHAPE[category] === 'bag' && <path d="M24 26 Q24 14 32 14 Q40 14 40 26" fill="none" stroke="var(--ink)" strokeOpacity="0.45" strokeWidth="2" />}
    </svg>
  )
}
