// The garment vocabulary Claude tags with and the stylist reasons about.
// Adapted from wardrowbe's garment_vocabulary.json, plus Indian wear.
//
// role decides which body "slot" a piece fills, so an outfit never gets two
// tops or a dress over trousers. wash = wears before it goes in the laundry.

export const TYPES = [
  // Tops
  { value: 't-shirt', label: 'T-shirt', role: 'base_top', wash: 1, group: 'tops' },
  { value: 'shirt', label: 'Shirt', role: 'base_top', wash: 2, group: 'tops' },
  { value: 'polo', label: 'Polo', role: 'base_top', wash: 2, group: 'tops' },
  { value: 'top', label: 'Top', role: 'base_top', wash: 2, group: 'tops' },
  { value: 'blouse', label: 'Blouse', role: 'base_top', wash: 2, group: 'tops' },
  { value: 'tank-top', label: 'Tank top', role: 'base_top', wash: 1, group: 'tops' },
  { value: 'crop-top', label: 'Crop top', role: 'base_top', wash: 1, group: 'tops' },
  { value: 'sweater', label: 'Sweater', role: 'base_top', wash: 5, group: 'tops' },
  { value: 'sweatshirt', label: 'Sweatshirt', role: 'base_top', wash: 4, group: 'tops' },
  // Bottoms
  { value: 'jeans', label: 'Jeans', role: 'bottom', wash: 6, group: 'bottoms' },
  { value: 'pants', label: 'Trousers', role: 'bottom', wash: 4, group: 'bottoms' },
  { value: 'joggers', label: 'Joggers', role: 'bottom', wash: 3, group: 'bottoms' },
  { value: 'shorts', label: 'Shorts', role: 'bottom', wash: 3, group: 'bottoms' },
  { value: 'skirt', label: 'Skirt', role: 'bottom', wash: 3, group: 'bottoms' },
  { value: 'leggings', label: 'Leggings', role: 'bottom', wash: 2, group: 'bottoms' },
  // One-piece and sets
  { value: 'dress', label: 'Dress', role: 'full_body', wash: 2, group: 'onepiece' },
  { value: 'jumpsuit', label: 'Jumpsuit', role: 'full_body', wash: 2, group: 'onepiece' },
  { value: 'co-ord', label: 'Co-ord set', role: 'full_body', wash: 2, group: 'onepiece' },
  { value: 'suit', label: 'Suit', role: 'suit', wash: 5, group: 'onepiece' },
  // Indian wear
  { value: 'kurta', label: 'Kurta', role: 'base_top', wash: 2, group: 'ethnic' },
  { value: 'kurti', label: 'Kurti', role: 'base_top', wash: 2, group: 'ethnic' },
  { value: 'salwar', label: 'Salwar / churidar', role: 'bottom', wash: 3, group: 'ethnic' },
  { value: 'palazzo', label: 'Palazzo / sharara', role: 'bottom', wash: 3, group: 'ethnic' },
  { value: 'dhoti', label: 'Dhoti / lungi', role: 'bottom', wash: 2, group: 'ethnic' },
  { value: 'saree', label: 'Saree', role: 'full_body', wash: 1, group: 'ethnic' },
  { value: 'lehenga', label: 'Lehenga', role: 'full_body', wash: 1, group: 'ethnic' },
  { value: 'anarkali', label: 'Anarkali / gown', role: 'full_body', wash: 1, group: 'ethnic' },
  { value: 'nehru-jacket', label: 'Nehru jacket', role: 'mid_layer', wash: 5, group: 'ethnic' },
  { value: 'sherwani', label: 'Sherwani / bandhgala', role: 'outer_layer', wash: 3, group: 'ethnic' },
  { value: 'dupatta', label: 'Dupatta / stole', role: 'accessory', wash: 3, group: 'ethnic' },
  // Layers
  { value: 'jacket', label: 'Jacket', role: 'outer_layer', wash: 8, group: 'layers' },
  { value: 'overshirt', label: 'Overshirt / shacket', role: 'outer_layer', wash: 4, group: 'layers' },
  { value: 'hoodie', label: 'Hoodie', role: 'outer_layer', wash: 4, group: 'layers' },
  { value: 'blazer', label: 'Blazer', role: 'outer_layer', wash: 5, group: 'layers' },
  { value: 'coat', label: 'Coat', role: 'outer_layer', wash: 10, group: 'layers' },
  { value: 'cardigan', label: 'Cardigan', role: 'mid_layer', wash: 5, group: 'layers' },
  { value: 'vest', label: 'Vest / waistcoat', role: 'mid_layer', wash: 5, group: 'layers' },
  // Footwear
  { value: 'sneakers', label: 'Sneakers', role: 'footwear', wash: 15, group: 'shoes' },
  { value: 'shoes', label: 'Formal shoes / loafers', role: 'footwear', wash: 15, group: 'shoes' },
  { value: 'boots', label: 'Boots', role: 'footwear', wash: 15, group: 'shoes' },
  { value: 'sandals', label: 'Sandals / slides', role: 'footwear', wash: 15, group: 'shoes' },
  { value: 'heels', label: 'Heels', role: 'footwear', wash: 15, group: 'shoes' },
  { value: 'flats', label: 'Flats / ballerinas', role: 'footwear', wash: 15, group: 'shoes' },
  { value: 'juttis', label: 'Juttis / kolhapuris', role: 'footwear', wash: 15, group: 'shoes' },
  // Accessories
  { value: 'bag', label: 'Bag', role: 'accessory', wash: 20, group: 'accessories' },
  { value: 'belt', label: 'Belt', role: 'accessory', wash: 20, group: 'accessories' },
  { value: 'hat', label: 'Cap / hat', role: 'accessory', wash: 20, group: 'accessories' },
  { value: 'watch', label: 'Watch', role: 'accessory', wash: 30, group: 'accessories' },
  { value: 'sunglasses', label: 'Sunglasses', role: 'accessory', wash: 30, group: 'accessories' },
  { value: 'jewellery', label: 'Jewellery', role: 'accessory', wash: 30, group: 'accessories' },
  { value: 'scarf', label: 'Scarf', role: 'accessory', wash: 10, group: 'accessories' },
  { value: 'tie', label: 'Tie', role: 'neckwear', wash: 20, group: 'accessories' },
  { value: 'socks', label: 'Socks', role: 'socks', wash: 1, group: 'accessories' },
  { value: 'other', label: 'Other accessory', role: 'accessory', wash: 20, group: 'accessories' },
]

export const TYPE_BY_VALUE = Object.fromEntries(TYPES.map((t) => [t.value, t]))

export const typeOf = (category) => TYPE_BY_VALUE[category] ?? TYPE_BY_VALUE.other
export const roleOf = (category) => typeOf(category).role
export const typeLabel = (category) => typeOf(category).label

export const GROUPS = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'onepiece', label: 'Dresses & sets' },
  { value: 'ethnic', label: 'Indian wear' },
  { value: 'layers', label: 'Layers' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
]

// Swatch values are for display only; Claude tags with the names.
export const COLORS = [
  { value: 'black', label: 'Black', hex: '#1d1d21' },
  { value: 'charcoal', label: 'Charcoal', hex: '#45474f' },
  { value: 'gray', label: 'Grey', hex: '#9a9ca5' },
  { value: 'white', label: 'White', hex: '#fafaf7' },
  { value: 'cream', label: 'Cream', hex: '#efe5cf' },
  { value: 'beige', label: 'Beige', hex: '#d8c4a2' },
  { value: 'khaki', label: 'Khaki', hex: '#b3a479' },
  { value: 'tan', label: 'Tan', hex: '#b88a5a' },
  { value: 'brown', label: 'Brown', hex: '#6e4a2e' },
  { value: 'navy', label: 'Navy', hex: '#1f2850' },
  { value: 'indigo', label: 'Indigo / denim', hex: '#34477a' },
  { value: 'blue', label: 'Blue', hex: '#2f63b8' },
  { value: 'light-blue', label: 'Light blue', hex: '#a2c6e8' },
  { value: 'teal', label: 'Teal', hex: '#1f7b7b' },
  { value: 'green', label: 'Green', hex: '#2f7d4f' },
  { value: 'olive', label: 'Olive', hex: '#6b6f35' },
  { value: 'mint', label: 'Mint', hex: '#acdcc4' },
  { value: 'yellow', label: 'Yellow', hex: '#ecc94b' },
  { value: 'mustard', label: 'Mustard', hex: '#c69a1f' },
  { value: 'orange', label: 'Orange', hex: '#e2792d' },
  { value: 'rust', label: 'Rust', hex: '#a64a28' },
  { value: 'red', label: 'Red', hex: '#c4282d' },
  { value: 'maroon', label: 'Maroon', hex: '#6a1b2b' },
  { value: 'pink', label: 'Pink', hex: '#eb9db4' },
  { value: 'magenta', label: 'Magenta', hex: '#b5317c' },
  { value: 'lavender', label: 'Lavender', hex: '#b9a7dd' },
  { value: 'purple', label: 'Purple', hex: '#6a3e9f' },
  { value: 'gold', label: 'Gold', hex: '#c7a03a' },
  { value: 'silver', label: 'Silver', hex: '#b9bdc4' },
  { value: 'multicolor', label: 'Multicolour', hex: 'conic-gradient(#c4282d, #ecc94b, #2f7d4f, #2f63b8, #6a3e9f, #c4282d)' },
]

export const COLOR_BY_VALUE = Object.fromEntries(COLORS.map((c) => [c.value, c]))
export const colorHex = (value) => COLOR_BY_VALUE[value]?.hex ?? '#9a9ca5'
export const colorLabel = (value) => COLOR_BY_VALUE[value]?.label ?? value
/** 'Indigo / denim' → 'Indigo', for building names like "Indigo jeans". */
export const colorWord = (value) => colorLabel(value).split(' / ')[0]

export const PATTERNS = [
  'solid',
  'striped',
  'checked',
  'floral',
  'graphic',
  'printed',
  'embroidered',
  'polka-dot',
  'geometric',
  'colour-block',
  'textured',
  'camouflage',
  'animal-print',
]

export const MATERIALS = [
  'cotton',
  'denim',
  'linen',
  'jersey',
  'knit',
  'wool',
  'fleece',
  'polyester',
  'rayon',
  'silk',
  'chiffon',
  'georgette',
  'velvet',
  'satin',
  'leather',
  'suede',
  'canvas',
  'nylon',
  'mesh',
  'metal',
]

export const STYLES = [
  'casual',
  'classic',
  'minimal',
  'streetwear',
  'sporty',
  'preppy',
  'smart',
  'boho',
  'vintage',
  'edgy',
  'elegant',
  'ethnic',
  'festive',
]

export const FITS = ['slim', 'regular', 'relaxed', 'oversized', 'cropped', 'tailored', 'flared']

export const FORMALITY = [
  { value: 1, label: 'Lounge' },
  { value: 2, label: 'Casual' },
  { value: 3, label: 'Smart casual' },
  { value: 4, label: 'Dressy' },
  { value: 5, label: 'Formal' },
]

export const WARMTH = [
  { value: 1, label: 'Breezy' },
  { value: 2, label: 'Light' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Warm' },
  { value: 5, label: 'Heavy' },
]

export const OCCASIONS = [
  { value: 'everyday', label: 'Everyday' },
  { value: 'college', label: 'School / college' },
  { value: 'hangout', label: 'Hangout' },
  { value: 'date', label: 'Date' },
  { value: 'party', label: 'Party' },
  { value: 'festive', label: 'Festival / puja' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'work', label: 'Interview / office' },
  { value: 'gym', label: 'Gym / sport' },
  { value: 'travel', label: 'Travel' },
  { value: 'home', label: 'At home' },
]
export const occasionLabel = (v) => OCCASIONS.find((o) => o.value === v)?.label ?? v

// Temperature bands in °C. hot/cold drive the on-device ranking.
export const WEATHER = [
  { value: 'scorching', label: 'Scorching', range: '35°+', temp: 37 },
  { value: 'hot', label: 'Hot', range: '29–34°', temp: 31 },
  { value: 'warm', label: 'Warm', range: '24–28°', temp: 26 },
  { value: 'mild', label: 'Mild', range: '18–23°', temp: 21 },
  { value: 'cool', label: 'Cool', range: '12–17°', temp: 15 },
  { value: 'cold', label: 'Cold', range: 'under 12°', temp: 8 },
]
export const weatherOf = (v) => WEATHER.find((w) => w.value === v) ?? WEATHER[2]

export const TIMES = [
  { value: 'morning', label: 'Morning' },
  { value: 'day', label: 'Daytime' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night out' },
  { value: 'allday', label: 'All day' },
]

export const DRESSING_FOR = [
  { value: 'any', label: 'No preference' },
  { value: 'mens', label: 'Menswear' },
  { value: 'womens', label: 'Womenswear' },
]

export const DEFAULT_SETTINGS = {
  dressingFor: 'any',
  styles: [],
  loveColors: [],
  avoidColors: [],
  city: '',
  notes: '',
}
