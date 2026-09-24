// In-browser OCR with Tesseract.js. The engine loads from the jsDelivr CDN the
// first time someone scans a menu, so the app itself stays small. The worker
// script and the 3 MB English model ship with the app, because some hosts,
// like claude.ai, allow only scripts (not data) from CDNs; public/ocr-worker.js
// points Tesseract at them. The model (gzipped LSTM data) carries a .wasm
// extension only so every static host serves it as plain binary; Tesseract
// detects and unzips the gzip data itself.
//
// When on-device OCR can't run and the page is on claude.ai, Claude reads the
// photo instead (the `sample` capability), which also copes with messy photos.

import engineUrl from 'tesseract.js/dist/worker.min.js?url'

const MAX_SIDE = 2000

/** Downscale big phone photos: faster OCR, and accuracy doesn't suffer. */
async function prepare(file) {
  if (typeof createImageBitmap !== 'function') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas
}

const STAGES = {
  'loading tesseract core': 'Loading OCR engine…',
  'initializing tesseract': 'Starting OCR engine…',
  'loading language traineddata': 'Loading English model…',
  'initializing api': 'Getting ready…',
  'recognizing text': 'Reading menu…',
}

/**
 * Recognize text in an image file.
 * onProgress receives { label, progress } with progress in 0–1 (or null).
 */
export async function recognizeMenuImage(file, onProgress = () => {}) {
  onProgress({ label: 'Loading OCR engine…', progress: null })
  let image
  try {
    image = await prepare(file)
  } catch {
    throw new Error("Couldn't open that image. Try a JPG or PNG photo or screenshot.")
  }

  let createWorker
  try {
    ;({ createWorker } = await import('tesseract.js'))
  } catch {
    throw new Error('The OCR engine failed to load. Check your connection, or type the menu below.')
  }

  const here = (path) => new URL(path, document.baseURI).href
  const workerPath = `${here('ocr-worker.js')}?engine=${encodeURIComponent(here(engineUrl))}&model=${encodeURIComponent(here('tessdata/eng-traineddata.wasm'))}`

  const worker = await createWorker('eng', 1, {
    workerPath,
    workerBlobURL: false,
    logger: (m) => {
      const label = STAGES[m.status]
      if (label) onProgress({ label, progress: m.status === 'recognizing text' ? m.progress : null })
    },
  }).catch(() => {
    throw new Error('The OCR engine needs internet the first time it runs. You can still type or paste the menu below.')
  })

  try {
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    worker.terminate()
  }
}

async function claudeReader() {
  if (typeof window.claude?.use !== 'function') return null
  const sample = await window.claude.use('sample')
  if (!sample) return null
  const limits = await sample.limits().catch(() => null)
  return limits?.images ? sample : null
}

/** True when this page can ask Claude to read a photo. */
export async function canAskClaude() {
  return Boolean(await claudeReader().catch(() => null))
}

/** Have Claude transcribe the dishes on a menu photo, one per line. */
export async function readMenuWithClaude(file, onProgress = () => {}) {
  const sample = await claudeReader()
  if (!sample) throw new Error('Claude can’t read images on this page.')
  onProgress({ label: 'Asking Claude to read the menu…', progress: null })
  const canvas = await prepare(file)
  const blob = canvas instanceof HTMLCanvasElement ? await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85)) : canvas
  const { text } = await sample(
    'This photo is a school cafeteria menu. List every food and drink item on it, one per line, ' +
      'exactly as written (keep words like "w/" or "&"). Skip dates, prices, headings and notes. ' +
      'Output only the list, no bullets or commentary.',
    { images: blob, modelTier: 'quick' },
  )
  return text
}
