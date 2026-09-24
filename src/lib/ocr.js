// In-browser OCR with Tesseract.js. The library (and its ~10 MB English model,
// fetched from the jsDelivr CDN and cached by the browser) only loads the
// first time someone scans a menu, so the app itself stays small.

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

  const worker = await createWorker('eng', 1, {
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
