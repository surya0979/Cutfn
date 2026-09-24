import { Camera, Check, ImageUp, LoaderCircle, Minus, Plus, ScanLine, Sparkles, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { parseMenu, SAMPLE_MENU } from '../lib/menuParser.js'
import { canAskClaude, readMenuWithClaude, recognizeMenuImage } from '../lib/ocr.js'
import { COLORS } from '../lib/theme.js'
import { fmtInt } from '../lib/units.js'
import { Button, inputClass, Swatch } from './ui.jsx'

const SERVING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3]

function MacroLine({ p, c, f }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-2">
      <span className="inline-flex items-center gap-1">
        <Swatch color={COLORS.protein} /> P {Math.round(p)}g
      </span>
      <span className="inline-flex items-center gap-1">
        <Swatch color={COLORS.carbs} /> C {Math.round(c)}g
      </span>
      <span className="inline-flex items-center gap-1">
        <Swatch color={COLORS.fat} /> F {Math.round(f)}g
      </span>
    </span>
  )
}

function ResultRow({ item, onAdd }) {
  const { food, fuzzy, matchedText } = item
  const [servings, setServings] = useState(1)
  const [added, setAdded] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const step = (dir) => {
    const i = SERVING_STEPS.indexOf(servings) + dir
    if (i >= 0 && i < SERVING_STEPS.length) setServings(SERVING_STEPS[i])
  }

  const scaled = {
    kcal: Math.round(food.kcal * servings),
    p: food.p * servings,
    c: food.c * servings,
    f: food.f * servings,
  }

  const add = () => {
    onAdd({
      name: servings === 1 ? food.name : `${food.name} ×${servings}`,
      portion: `${servings === 1 ? '' : `${servings} × `}${food.portion}`,
      kcal: scaled.kcal,
      protein: Math.round(scaled.p),
      carbs: Math.round(scaled.c),
      fat: Math.round(scaled.f),
      source: 'menu',
    })
    setAdded(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAdded(false), 1600)
  }

  return (
    <li className="rounded-xl bg-page p-3 ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{food.name}</p>
          <p className="text-xs text-muted">
            {servings === 1 ? '' : `${servings} × `}
            {food.portion}
            {food.generic && ' · ballpark'}
          </p>
          {fuzzy && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-warning">
              <ScanLine className="size-3" aria-hidden />
              read as “{matchedText}”
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-lg font-bold">{fmtInt(scaled.kcal)}</span>
          <span className="ml-1 text-xs text-muted">kcal</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <MacroLine {...scaled} />
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg ring-1 ring-line" role="group" aria-label={`Servings of ${food.name}`}>
            <button type="button" onClick={() => step(-1)} disabled={servings === SERVING_STEPS[0]} className="grid size-8 place-items-center text-ink-2 disabled:opacity-30" aria-label="Fewer servings">
              <Minus className="size-3.5" />
            </button>
            <span className="w-9 text-center text-sm font-semibold" aria-live="polite">
              {servings}×
            </span>
            <button type="button" onClick={() => step(1)} disabled={servings === SERVING_STEPS.at(-1)} className="grid size-8 place-items-center text-ink-2 disabled:opacity-30" aria-label="More servings">
              <Plus className="size-3.5" />
            </button>
          </div>
          <Button onClick={add} className={`min-w-28 py-1.5 ${added ? '!bg-good !text-white' : ''}`} aria-label={`Add ${food.name} to log`}>
            {added ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {added ? 'Added' : 'Add to Log'}
          </Button>
        </div>
      </div>
    </li>
  )
}

export default function MenuScanner({ onAdd, onManual }) {
  const [text, setText] = useState('')
  const [scan, setScan] = useState({ status: 'idle' })
  const [preview, setPreview] = useState(null)
  const [dragging, setDragging] = useState(false)
  const cameraInput = useRef(null)
  const fileInput = useRef(null)

  const deferredText = useDeferredValue(text)
  const { items, unmatched } = useMemo(() => parseMenu(deferredText), [deferredText])
  const working = scan.status === 'working'

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  async function handleFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setScan({ status: 'error', message: 'That file isn’t an image. Try a photo or screenshot of the menu.' })
      return
    }
    setPreview(URL.createObjectURL(file))
    setScan({ status: 'working', label: 'Loading OCR engine…', progress: null })
    const onProgress = (p) => setScan({ status: 'working', ...p })
    try {
      let result
      try {
        result = await recognizeMenuImage(file, onProgress)
      } catch (ocrError) {
        // On-device OCR is unavailable here; fall back to Claude when the page can ask it.
        if (!(await canAskClaude())) throw ocrError
        result = await readMenuWithClaude(file, onProgress)
      }
      const cleaned = result.replace(/\n{3,}/g, '\n\n').trim()
      setText(cleaned)
      const found = parseMenu(cleaned).items.length
      setScan({
        status: 'done',
        message: found
          ? `Found ${found} dish${found === 1 ? '' : 'es'}. Fix any misread text below and the estimates update.`
          : 'No known dishes found. Edit the text below or type the dishes in.',
      })
    } catch (err) {
      const message = err?.code === 'not_granted' ? 'Photo reading was declined. Type or paste the menu below instead.' : err?.message || 'Couldn’t read that photo. Type or paste the menu below.'
      setScan({ status: 'error', message })
    }
  }

  const onPaste = (e) => {
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
    if (file) {
      e.preventDefault()
      handleFile(file)
    }
  }

  const reset = () => {
    setText('')
    setPreview(null)
    setScan({ status: 'idle' })
  }

  return (
    <div className="space-y-4" onPaste={onPaste}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
          dragging ? 'border-volt bg-volt-soft' : 'border-line bg-page'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          {preview && <img src={preview} alt="Scanned menu" className="h-24 max-w-full rounded-lg object-contain ring-1 ring-line" />}
          {working ? (
            <div className="w-full max-w-xs py-2" role="status" aria-live="polite">
              <LoaderCircle className="mx-auto mb-2 size-6 animate-spin text-volt" aria-hidden />
              <p className="text-sm font-medium">{scan.label}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full bg-volt transition-[width] duration-300 ${scan.progress == null ? 'w-1/3 animate-pulse' : ''}`}
                  style={scan.progress == null ? undefined : { width: `${Math.max(4, scan.progress * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              {!preview && <ScanLine className="size-7 text-volt" aria-hidden />}
              <div>
                <p className="text-sm font-semibold">{preview ? 'Scan another photo' : 'Drop, paste or snap a photo of the school menu'}</p>
                <p className="text-xs text-muted">Text is read on your device. Nothing is uploaded.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => cameraInput.current?.click()}>
                  <Camera className="size-4" aria-hidden /> Take photo
                </Button>
                <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                  <ImageUp className="size-4" aria-hidden /> Upload image
                </Button>
              </div>
            </>
          )}
        </div>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>

      {(scan.status === 'done' || scan.status === 'error') && (
        <p role="status" className={`text-sm ${scan.status === 'error' ? 'text-critical-ink' : 'text-ink-2'}`}>
          {scan.message}
        </p>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor="menu-text" className="text-xs font-medium text-ink-2">
            Menu text <span className="font-normal text-muted">(from the scan, or type/paste it)</span>
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                setText(SAMPLE_MENU)
                setScan({ status: 'idle' })
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-volt hover:bg-raised"
            >
              <Sparkles className="size-3.5" aria-hidden /> Try sample
            </button>
            {(text || preview) && (
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-ink">
                <X className="size-3.5" aria-hidden /> Clear
              </button>
            )}
          </div>
        </div>
        <textarea
          id="menu-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={text ? 5 : 3}
          placeholder={'e.g. Chicken nuggets, tater tots, chocolate milk'}
          className={`${inputClass} resize-y font-mono text-[13px] leading-relaxed`}
          disabled={working}
        />
      </div>

      {items.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-muted">
            {items.length} dish{items.length === 1 ? '' : 'es'} · estimates for a typical school portion
          </p>
          <ul className="space-y-2">
            {items.map((item) => (
              <ResultRow key={item.food.id} item={item} onAdd={onAdd} />
            ))}
          </ul>
        </div>
      )}

      {unmatched.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-muted">Not recognized. Tap one to log it manually:</p>
          <div className="flex flex-wrap gap-1.5">
            {unmatched.slice(0, 12).map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => onManual(line)}
                className="max-w-full truncate rounded-full bg-raised px-3 py-1 text-xs text-ink-2 ring-1 ring-line hover:text-ink hover:ring-volt/40"
              >
                {line}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
