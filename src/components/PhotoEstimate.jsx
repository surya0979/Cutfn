import { Camera, ImageUp, LoaderCircle, Sparkles, Tag, UtensilsCrossed, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { estimateFromPhoto, usePhotoAvailable } from '../lib/aiEstimate.js'
import { fmtInt } from '../lib/units.js'
import { ResultRow } from './MenuScanner.jsx'
import { Button, inputClass, Segmented } from './ui.jsx'

const MODES = {
  plate: {
    hint: 'Snap your tray or plate from above with everything in view.',
    noteLabel: 'Anything Claude should know?',
    notePlaceholder: 'e.g. ate only half the rice',
  },
  label: {
    hint: 'Snap the nutrition table on the pack, close and in focus.',
    noteLabel: 'How much did you eat?',
    notePlaceholder: 'e.g. whole pack, 2 biscuits, 30 g',
  },
}

/** Photo → Claude → calorie cards, for a plate of food or a nutrition label. */
export default function PhotoEstimate({ onAdd }) {
  const photoOk = usePhotoAvailable()
  const [mode, setMode] = useState('plate')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState({ status: 'idle' })
  const camera = useRef(null)
  const picker = useRef(null)
  const abort = useRef(null)

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])
  useEffect(() => () => abort.current?.abort(), [])

  const choose = (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setState({ status: 'error', message: 'That isn’t a photo. Choose a JPG, PNG or phone photo.' })
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setState({ status: 'idle' })
  }

  const reset = () => {
    abort.current?.abort()
    setFile(null)
    setPreview(null)
    setNote('')
    setState({ status: 'idle' })
  }

  async function estimate() {
    if (!file) return
    abort.current = new AbortController()
    setState({ status: 'working' })
    try {
      const items = await estimateFromPhoto(file, { mode, note, signal: abort.current.signal })
      setState({
        status: 'done',
        items: items.map((it, i) => ({
          food: { id: `photo-${i}-${it.name}`, name: it.name, portion: it.portion, assumption: it.assumption, kcal: it.kcal, p: it.protein, c: it.carbs, f: it.fat },
          matchedText: it.name,
          fuzzy: false,
        })),
      })
    } catch (err) {
      if (abort.current?.signal.aborted) return setState({ status: 'idle' })
      setState({ status: 'error', message: err.message })
    }
  }

  if (photoOk === false) {
    return (
      <p className="rounded-xl bg-page px-3 py-3 text-sm text-muted ring-1 ring-line">
        Photo estimates use Claude, so they work in the claude.ai version of Cutfn. Here, use Manual or Scan menu instead.
      </p>
    )
  }

  const total = state.items?.reduce((s, i) => s + i.food.kcal, 0) ?? 0
  const m = MODES[mode]

  return (
    <div className="space-y-3">
      <Segmented
        label="What’s in the photo"
        value={mode}
        onChange={(v) => {
          setMode(v)
          setState({ status: 'idle' })
        }}
        className="w-full"
        options={[
          { value: 'plate', label: 'My plate', icon: UtensilsCrossed },
          { value: 'label', label: 'Nutrition label', icon: Tag },
        ]}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          choose(e.dataTransfer.files?.[0])
        }}
        className="relative flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-line bg-page p-4 text-center"
      >
        {preview ? (
          <>
            <img src={preview} alt="Your photo" className="max-h-56 max-w-full rounded-lg object-contain ring-1 ring-line" />
            <button type="button" onClick={reset} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-raised text-ink-2 ring-1 ring-line hover:text-ink" aria-label="Remove photo">
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            <Camera className="size-7 text-volt" aria-hidden />
            <p className="text-sm text-ink-2">{m.hint}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => camera.current?.click()}>
                <Camera className="size-4" aria-hidden /> Take photo
              </Button>
              <Button variant="secondary" onClick={() => picker.current?.click()}>
                <ImageUp className="size-4" aria-hidden /> Choose photo
              </Button>
            </div>
          </>
        )}
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (choose(e.target.files?.[0]), (e.target.value = ''))} />
        <input ref={picker} type="file" accept="image/*" className="hidden" onChange={(e) => (choose(e.target.files?.[0]), (e.target.value = ''))} />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-2">
          {m.noteLabel} <span className="font-normal text-muted">(optional)</span>
        </span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={m.notePlaceholder} maxLength={200} className={inputClass} />
      </label>

      {state.status === 'working' ? (
        <div className="flex gap-2">
          <Button className="flex-1" disabled>
            <LoaderCircle className="size-4 animate-spin" aria-hidden /> Claude is looking at your photo…
          </Button>
          <Button variant="secondary" onClick={() => abort.current?.abort()}>
            Stop
          </Button>
        </div>
      ) : (
        <Button className="w-full" onClick={estimate} disabled={!file}>
          <Sparkles className="size-4" aria-hidden /> Estimate calories
        </Button>
      )}

      {state.status === 'error' && (
        <p role="alert" className="text-sm text-critical-ink">
          {state.message}
        </p>
      )}

      {state.status === 'done' && (
        <div>
          <p className="mb-2 text-xs text-muted">
            {state.items.length} item{state.items.length === 1 ? '' : 's'} · {fmtInt(total)} kcal total · adjust servings before adding
          </p>
          <ul className="space-y-2">
            {state.items.map((item) => (
              <ResultRow key={item.food.id} item={item} onAdd={onAdd} source="ai" />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
