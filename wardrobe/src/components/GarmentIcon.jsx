// A piece shown as its garment icon on a tile of its own colour. Used where a
// photo is missing or still on its way, and in the empty closet.

import { BaseballCap, Belt, Boot, CoatHanger, Diamond, Dress, Handbag, HighHeel, Hoodie, Pants, ShirtFolded, Sneaker, Sock, Sunglasses, Tag, TShirt, Watch } from '@phosphor-icons/react'
import { COLOR_BY_VALUE } from '../lib/vocab.js'

const ICONS = {
  't-shirt': TShirt, polo: TShirt, top: TShirt, 'crop-top': TShirt, 'tank-top': TShirt, blouse: TShirt,
  shirt: ShirtFolded, sweater: ShirtFolded, sweatshirt: ShirtFolded, kurta: ShirtFolded, kurti: ShirtFolded, tie: ShirtFolded,
  hoodie: Hoodie, jacket: Hoodie, overshirt: Hoodie,
  blazer: CoatHanger, coat: CoatHanger, cardigan: CoatHanger, vest: CoatHanger, sherwani: CoatHanger, 'nehru-jacket': CoatHanger, suit: CoatHanger,
  jeans: Pants, pants: Pants, joggers: Pants, leggings: Pants, salwar: Pants, palazzo: Pants, dhoti: Pants, shorts: Pants,
  skirt: Dress, dress: Dress, jumpsuit: Dress, 'co-ord': Dress, saree: Dress, lehenga: Dress, anarkali: Dress,
  sneakers: Sneaker, shoes: Sneaker, sandals: Sneaker, flats: Sneaker, juttis: Sneaker,
  boots: Boot, heels: HighHeel,
  bag: Handbag, belt: Belt, hat: BaseballCap, watch: Watch, sunglasses: Sunglasses, jewellery: Diamond, socks: Sock,
  scarf: Tag, dupatta: Tag, other: Tag,
}

/** Relative luminance of a #rrggbb colour, 0 (black) to 1 (white). */
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export default function GarmentIcon({ category, color, className = '', iconClassName = 'size-1/2' }) {
  const Icon = ICONS[category] ?? Tag
  const hex = COLOR_BY_VALUE[color]?.hex
  const solid = hex && hex.startsWith('#')
  const ink = solid && luminance(hex) > 0.4 ? '#151515' : '#f4f4f0'
  return (
    <div className={`flex items-center justify-center ${className}`} style={solid ? { background: hex, color: ink } : { background: 'var(--raised)', color: 'var(--ink-2)' }}>
      <Icon weight="duotone" className={iconClassName} aria-hidden="true" />
    </div>
  )
}
