import { Camera, Check, FileUp, LoaderCircle, Minus, Plus, ScanLine, Search, Sparkles, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { parseMenu, SAMPLE_MENU } from '../lib/menuParser.js'
import { canAskClaude, readMenuWithClaude, recognizeMenuImage } from '../lib/ocr.js'
import { readSpreadsheetText } from '../lib/xlsx.js'
import { estimateFoods, useAiAvailable } from '../lib/aiEstimate.js'
import { COLORS } from '../lib/theme.js'
import { fmtInt } from '../lib/units.js'
import { Button, inputClass, Swatch } from './ui.jsx'

const SERVING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3]
const FIRST_PAGE = 12
const isSpreadsheet = (f) => /\.xlsx$/i.test(f.name) || f.type.includes('spreadsheetml')
const isTextFile = (f) => /\.(csv|txt|tsv)$/i.test(f.name) || f.type.startsWith('text/')

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

export function ResultRow({ item, onAdd, source = 'menu' }) {
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
      source,
      note: food.assumption,
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
          {source === 'ai' && (
            <p className="mt-0.5 flex items-start gap-1 text-xs text-ink-2">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-volt" aria-hidden />
              <span>AI estimate{food.assumption ? ` · ${food.assumption}` : ''}</span>
            </p>
          )}
          {fuzzy && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-warning">
              <ScanLine className="size-3" aria-hidden />
              read as “{matchedText}”
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="font-display text-2xl font-bold leading-none">{fmtInt(scaled.kcal)}</span>
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
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const aiAvailable = useAiAvailable()
  const [ai, setAi] = useState({ status: 'idle', items: [], for: '' })
  const cameraInput = useRef(null)
  const fileInput = useRef(null)

  const deferredText = useDeferredValue(text)
  const { items, unmatched } = useMemo(() => parseMenu(deferredText), [deferredText])
  const working = scan.status === 'working'
  const query = filter.trim().toLowerCase()
  const filtered = query ? items.filter((i) => `${i.food.name} ${i.matchedText}`.toLowerCase().includes(query)) : items
  const shown = query || showAll ? filtered : filtered.slice(0, FIRST_PAGE)

  const unmatchedKey = unmatched.join('\n')
  const aiItems = ai.for === unmatchedKey ? ai.items : []

  async function estimateUnmatched() {
    const key = unmatchedKey
    setAi({ status: 'working', items: [], for: key })
    try {
      const results = await estimateFoods(unmatched.join('\n'))
      const items = results.map((it, i) => ({
        food: { id: `ai-${i}-${it.name}`, name: it.name, portion: it.portion, assumption: it.assumption, kcal: it.kcal, p: it.protein, c: it.carbs, f: it.fat },
        matchedText: it.name,
        fuzzy: false,
      }))
      setAi({ status: 'done', items, for: key })
    } catch (err) {
      setAi({ status: 'error', items: [], for: key, message: err.message })
    }
  }

  const showText = (value, source) => {
    const cleaned = value.replace(/\n{3,}/g, '\n\n').trim()
    setText(cleaned)
    setFilter('')
    setShowAll(false)
    const found = parseMenu(cleaned).items.length
    setScan({
      status: 'done',
      message: found
        ? `Found ${found} dish${found === 1 ? '' : 'es'}${source ? ` in ${source}` : ''}. Edit the text below and the estimates update.`
        : 'No known dishes found. Edit the text below or type the dishes in.',
    })
  }

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  async function handleFile(file) {
    if (!file) return
    if (isSpreadsheet(file) || isTextFile(file)) {
      setPreview(null)
      try {
        showText(isSpreadsheet(file) ? await readSpreadsheetText(file) : await file.text(), file.name)
      } catch {
        setScan({ status: 'error', message: 'Couldn’t read that file. Save it as .xlsx or .csv, or paste the menu below.' })
      }
      return
    }
    if (!file.type.startsWith('image/')) {
      setScan({ status: 'error', message: 'Use a photo, a screenshot, or an .xlsx / .csv menu file.' })
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
      showText(result)
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
                <p className="text-sm font-semibold">{preview ? 'Scan another menu' : 'Drop in your school menu'}</p>
                <p className="text-xs text-muted">A photo, a screenshot, or the weekly .xlsx file. Read on your device.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => cameraInput.current?.click()}>
                  <Camera className="size-4" aria-hidden /> Take photo
                </Button>
                <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                  <FileUp className="size-4" aria-hidden /> Upload file
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
          accept="image/*,.xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
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
          rows={text ? 8 : 5}
          placeholder={'Paste the menu here, one dish per line or separated by commas.\ne.g. Chole masala, chapati, jeera rice, curd'}
          className={`${inputClass} resize-y font-mono text-[13px] leading-relaxed`}
          disabled={working}
        />
      </div>

      {items.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              {items.length} dish{items.length === 1 ? '' : 'es'} found · estimates for a typical canteen portion
            </p>
            {items.length > 6 && (
              <label className="relative block w-full sm:w-52">
                <span className="sr-only">Filter dishes</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Find a dish"
                  className={`${inputClass} py-1.5 pl-8 text-sm`}
                />
              </label>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            {shown.map((item) => (
              <ResultRow key={item.food.id} item={item} onAdd={onAdd} />
            ))}
          </ul>
          {query && filtered.length === 0 && <p className="mt-2 text-sm text-muted">No dish matches “{filter}”.</p>}
          {!query && !showAll && filtered.length > FIRST_PAGE && (
            <Button variant="secondary" className="mt-2 w-full" onClick={() => setShowAll(true)}>
              Show all {filtered.length} dishes
            </Button>
          )}
        </div>
      )}

      {unmatched.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs text-muted">
            Not in the food list{aiAvailable ? '. Let Claude estimate them, or tap one to enter it yourself:' : '. Tap one to log it manually:'}
          </p>
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
          {aiAvailable && aiItems.length === 0 && (
            <Button variant="secondary" className="mt-2 w-full" onClick={estimateUnmatched} disabled={ai.status === 'working' && ai.for === unmatchedKey}>
              {ai.status === 'working' && ai.for === unmatchedKey ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" aria-hidden /> Asking Claude…
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-volt" aria-hidden /> Estimate {unmatched.length === 1 ? 'it' : `these ${Math.min(unmatched.length, 12)}`} with AI
                </>
              )}
            </Button>
          )}
          {ai.status === 'error' && ai.for === unmatchedKey && <p className="mt-2 text-sm text-critical-ink">{ai.message}</p>}
          {aiItems.length > 0 && (
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
              {aiItems.map((item) => (
                <ResultRow key={item.food.id} item={item} onAdd={onAdd} source="ai" />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
