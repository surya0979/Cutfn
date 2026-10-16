// Photo handling on the device: decode whatever the phone gives us, then
// re-encode two JPEGs. A small thumbnail lives inside the item record so
// the closet grid draws instantly; the full photo is stored separately.

export const FULL_SIDE = 1280
export const THUMB_SIDE = 360

async function decode(file) {
  try {
    // Honors EXIF orientation in current browsers.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Some browsers (and HEIC on Safari) only decode through <img>.
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function draw(source, maxSide) {
  const w = source.width
  const h = source.height
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  // Cut-out PNGs have transparent backgrounds; JPEG would turn them black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

const toBlob = (canvas, quality) =>
  new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality))

export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

// Decoded by hand: the page's fetch() may not be allowed to read data: URLs.
export function dataUrlToBlob(dataUrl) {
  const [head, body] = String(dataUrl).split(',')
  const type = head.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
  const bytes = atob(body)
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i)
  return new Blob([out], { type })
}

/**
 * Prepare a picked photo: { full: Blob, thumb: dataURL, width, height }.
 * Throws an Error with a message ready to show.
 */
export async function preparePhoto(file) {
  let source
  try {
    source = await decode(file)
  } catch {
    throw new Error(`Couldn’t open ${file.name || 'that photo'}. Use a JPG or PNG (iPhone: Settings › Camera › Formats › Most Compatible).`)
  }
  try {
    const full = await toBlob(draw(source, FULL_SIDE), 0.85)
    const thumb = await blobToDataUrl(await toBlob(draw(source, THUMB_SIDE), 0.74))
    return { full, thumb, width: source.width, height: source.height }
  } finally {
    source.close?.()
  }
}

/** A smaller version of a full photo, for storing inline when there's no photo storage. */
export async function shrink(blob, maxSide = 720, quality = 0.8) {
  const source = await decode(blob)
  try {
    return await toBlob(draw(source, maxSide), quality)
  } finally {
    source.close?.()
  }
}

export const isImageFile = (file) => file && (file.type?.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name ?? ''))
