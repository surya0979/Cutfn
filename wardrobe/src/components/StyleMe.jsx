import { Camera, CloudRain, Droplets, RefreshCw, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { curateOutfits, fitCheck } from '../lib/ai.js'
import { todayKey } from '../lib/dates.js'
import { preparePhoto } from '../lib/images.js'
import { readiness, sameOutfit, summarizeOutfit } from '../lib/outfits.js'
import { OCCASIONS, TIMES, WEATHER, occasionLabel, typeLabel } from '../lib/vocab.js'
import { usePhotoPicker } from './Closet.jsx'
import OutfitCard from './OutfitCard.jsx'
import { ItemImage, ItemTile } from './Pieces.jsx'
import { Button, Chip, Field, inputClass, Notice, Sheet, Spinner } from './ui.jsx'

const PLAN_KEY = 'fitfn.plan'
const DEFAULT_PLAN = { occasion: 'everyday', weather: 'warm', rain: false, humid: false, time: 'day', brief: '', mustInclude: null }

function readPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null')
    return { ...DEFAULT_PLAN, ...(saved ?? {}), brief: '', mustInclude: null }
  } catch {
    return DEFAULT_PLAN
  }
}
function writePlan(plan) {
  try {
    const { occasion, weather, rain, humid, time } = plan
    localStorage.setItem(PLAN_KEY, JSON.stringify({ occasion, weather, rain, humid, time }))
  } catch {
    /* per-device convenience only */
  }
}

function useElapsed(running) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!running) return
    setSecs(0)
    const start = Date.now()
    const t = setInterval(() => setSecs(Math.round((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(t)
  }, [running])
  return secs
}

function PiecePicker({ open, onClose, items, onPick }) {
  const [q, setQ] = useState('')
  const list = items.filter((i) => i.category && !i.laundry && (!q || `${i.name} ${typeLabel(i.category)}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <Sheet open={open} onClose={onClose} title="Build around a piece" wide>
      <div className="flex flex-col gap-4">
        <input id="pick-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your closet" className={`${inputClass} rounded-full`} />
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4">
          {list.map((item) => (
            <ItemTile
              key={item.id}
              item={item}
              onOpen={() => {
                onPick(item.id)
                onClose()
              }}
            />
          ))}
        </div>
        {!list.length && <p className="py-6 text-center text-muted">No clean, tagged pieces match.</p>}
      </div>
    </Sheet>
  )
}

function FitCheck({ plan, enabled }) {
  const [state, setState] = useState({ status: 'idle' })
  const ctl = useRef(null)
  const [picker, open] = usePhotoPicker(
    async (files) => {
      const file = files[0]
      if (!file) return
      ctl.current?.abort()
      const controller = new AbortController()
      ctl.current = controller
      let photo
      try {
        photo = await preparePhoto(file)
      } catch (err) {
        setState({ status: 'error', error: err.message })
        return
      }
      setState({ status: 'thinking', preview: photo.thumb })
      try {
        const context = `${occasionLabel(plan.occasion)}, ${WEATHER.find((w) => w.value === plan.weather)?.label.toLowerCase()} weather${plan.brief ? `. ${plan.brief}` : ''}`
        const result = await fitCheck(photo.full, { context, signal: controller.signal })
        setState({ status: 'done', preview: photo.thumb, result })
      } catch (err) {
        setState(err.code === 'cancelled' ? { status: 'idle' } : { status: 'error', preview: photo.thumb, error: err.message })
      }
    },
    { multiple: false },
  )
  useEffect(() => () => ctl.current?.abort(), [])
  if (!enabled) return null
  const { status, preview, result, error } = state

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-4 sm:p-5">
      {picker}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-display text-[22px] leading-tight font-semibold">Fit check</h2>
          <p className="text-[14px] text-ink-2">Already dressed? Send a mirror photo and get an honest second opinion.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={open} disabled={status === 'thinking'}>
          <Camera className="size-4" /> {status === 'idle' ? 'Add a photo' : 'Try another'}
        </Button>
      </div>
      {status !== 'idle' && (
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
          {preview ? <img src={preview} alt="Your outfit" className="aspect-[3/4] w-full rounded-xl object-cover" /> : <div />}
          <div className="flex min-w-0 flex-col gap-2">
            {status === 'thinking' && (
              <p className="flex items-center gap-2 text-ink-2">
                <Spinner /> Claude is looking…
              </p>
            )}
            {status === 'error' && <p className="text-critical">{error}</p>}
            {status === 'done' && result && (
              <>
                <p className="flex items-baseline gap-3">
                  {result.score != null && (
                    <span className="font-display text-[34px] leading-none font-semibold tnum">
                      {result.score}
                      <span className="text-[16px] text-muted">/10</span>
                    </span>
                  )}
                  <span className="font-display text-[18px] italic">{result.verdict}</span>
                </p>
                {result.good.map((g) => (
                  <p key={g} className="text-[14px]">
                    <span className="label mr-2 text-good">Works</span>
                    {g}
                  </p>
                ))}
                {result.tweaks.map((t) => (
                  <p key={t} className="text-[14px]">
                    <span className="label mr-2 text-accent-ink">Try</span>
                    {t}
                  </p>
                ))}
              </>
            )}
          </div>
        </div>
      )}
      <p className="label text-muted">The photo is only sent to Claude; it isn’t saved.</p>
    </section>
  )
}

export default function StyleMe({ items, itemsById, settings, taste, ai, actions, showToast, onOpenItem, request, onRequestHandled, looks }) {
  const [plan, setPlanState] = useState(readPlan)
  const [run, setRun] = useState({ status: 'idle', outfits: [], error: null })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [marks, setMarks] = useState({})
  const ctl = useRef(null)
  const results = useRef(null)
  const elapsed = useElapsed(run.status === 'thinking')

  const setPlan = (patch) =>
    setPlanState((p) => {
      const next = { ...p, ...patch }
      writePlan(next)
      return next
    })

  // "Style this piece" from elsewhere in the app.
  useEffect(() => {
    if (request?.mustInclude) {
      setPlan({ mustInclude: request.mustInclude })
      onRequestHandled()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  useEffect(() => () => ctl.current?.abort(), [])

  const clean = useMemo(() => items.filter((i) => i.category && !i.laundry), [items])
  const ready = readiness(items)
  const must = plan.mustInclude ? itemsById[plan.mustInclude] : null
  const busy = run.status === 'thinking' || run.status === 'streaming'
  const today = todayKey()

  const go = async ({ more = false } = {}) => {
    ctl.current?.abort()
    const controller = new AbortController()
    ctl.current = controller
    const avoid = more ? run.outfits.map((o) => o.itemIds) : []
    const kept = more ? run.outfits : []
    setRun({ status: 'thinking', outfits: kept, error: null })
    if (!more) setMarks({})
    requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    try {
      await curateOutfits({
        items,
        plan,
        settings,
        taste,
        today,
        avoid,
        count: 3,
        signal: controller.signal,
        onStart: () => setRun((r) => (r.status === 'thinking' ? { ...r, status: 'streaming' } : r)),
        onOutfit: (o) => setRun((r) => ({ ...r, status: 'streaming', outfits: [...r.outfits, o] })),
      })
      if (ctl.current === controller) setRun((r) => ({ ...r, status: 'done' }))
    } catch (err) {
      if (ctl.current !== controller) return
      setRun((r) => ({ ...r, status: err.code === 'cancelled' ? 'done' : 'error', error: err.code === 'cancelled' ? null : err.message }))
    }
  }

  const stop = () => {
    ctl.current?.abort()
  }

  const wear = (o, key) => {
    const { undo, toLaundry } = actions.logWear({ date: today, itemIds: o.itemIds, title: o.title, occasion: plan.occasion })
    setMarks((m) => ({ ...m, [key]: { ...m[key], worn: true } }))
    showToast({
      message: `Logged for today${toLaundry.length ? `. ${toLaundry.length} piece${toLaundry.length > 1 ? 's' : ''} to the laundry` : ''}`,
      onUndo: () => {
        undo()
        setMarks((m) => ({ ...m, [key]: { ...m[key], worn: false } }))
      },
    })
  }

  const save = (o, key) => {
    const id = actions.saveLook({ name: o.title, itemIds: o.itemIds, occasion: plan.occasion, why: o.why, tip: o.tip, source: 'claude' })
    setMarks((m) => ({ ...m, [key]: { ...m[key], saved: true } }))
    showToast({
      message: 'Saved to your looks',
      onUndo: () => {
        actions.deleteLook({ id })
        setMarks((m) => ({ ...m, [key]: { ...m[key], saved: false } }))
      },
    })
  }

  const feedback = (o, key, kind, reason) => {
    actions.addTaste(kind, { summary: summarizeOutfit(o.itemIds, itemsById), reason: reason ?? null })
    setMarks((m) => ({ ...m, [key]: { ...m[key], feedback: kind } }))
    showToast({ message: kind === 'liked' ? 'Noted. More like this next time' : 'Noted. Claude will steer away from this' })
  }

  const alreadySaved = (o) => looks.some((l) => sameOutfit(l.itemIds ?? [], o.itemIds))

  if (ai.text === false) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-[34px] leading-none font-semibold sm:text-[40px]">Style me</h1>
        <Notice>
          Outfit ideas come from Claude, which is only available when this app is opened on claude.ai. Your closet, saved looks and history still work here.
        </Notice>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] leading-none font-semibold sm:text-[40px]">Style me</h1>
        <p className="text-ink-2">Tell Claude what the day looks like. It picks from the {clean.length} clean piece{clean.length === 1 ? '' : 's'} in your closet.</p>
      </div>

      <section className="flex flex-col gap-5 rounded-3xl bg-surface p-4 shadow-card sm:p-5">
        <Field label="Occasion">
          <div className="flex flex-wrap gap-1.5">
            {OCCASIONS.map((o) => (
              <Chip key={o.value} active={plan.occasion === o.value} onClick={() => setPlan({ occasion: o.value })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Weather (°C)">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {WEATHER.map((w) => (
              <button
                key={w.value}
                type="button"
                aria-pressed={plan.weather === w.value}
                onClick={() => setPlan({ weather: w.value })}
                className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors ${
                  plan.weather === w.value ? 'border-ink bg-ink text-page' : 'border-line bg-surface text-ink hover:border-ink/35'
                }`}
              >
                <span className="text-[14px] font-semibold">{w.label}</span>
                <span className={`font-mono text-[11.5px] tnum ${plan.weather === w.value ? 'text-page/75' : 'text-muted'}`}>{w.range}</span>
              </button>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip active={plan.rain} onClick={() => setPlan({ rain: !plan.rain })}>
              <CloudRain className="size-4" /> Rain likely
            </Chip>
            <Chip active={plan.humid} onClick={() => setPlan({ humid: !plan.humid })}>
              <Droplets className="size-4" /> Humid
            </Chip>
          </div>
        </Field>

        <Field label="When">
          <div className="flex flex-wrap gap-1.5">
            {TIMES.map((t) => (
              <Chip key={t.value} active={plan.time === t.value} onClick={() => setPlan({ time: t.value })}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Anything else?">
          {(id) => (
            <textarea
              id={id}
              rows={2}
              value={plan.brief}
              onChange={(e) => setPlan({ brief: e.target.value })}
              placeholder="e.g. cousin’s mehendi, lots of sitting on the floor; want to look sharp but stay cool"
              className={inputClass}
              maxLength={300}
            />
          )}
        </Field>

        <div className="flex flex-col gap-2">
          <span className="label text-muted">Build around</span>
          {must ? (
            <div className="flex items-center gap-3 rounded-2xl bg-raised p-2 pr-3">
              <ItemImage item={must} className="size-14 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{must.name}</span>
                <span className="label text-muted">In every look</span>
              </div>
              <button type="button" aria-label="Remove" onClick={() => setPlan({ mustInclude: null })} className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              disabled={!clean.length}
              className="flex items-center justify-center rounded-2xl border border-dashed border-line px-4 py-3 text-[14px] text-ink-2 hover:border-ink/40 hover:text-ink disabled:opacity-40"
            >
              Optional: pick a piece to wear
            </button>
          )}
        </div>

        {!ready.ready && items.length > 0 && <Notice tone="warn">Add {ready.missing.join(' and ')} (or empty the laundry) so Claude can build a full outfit.</Notice>}
        {ready.ready && ready.missing.includes('shoes') && <Notice>No shoes in your closet yet. Outfits will skip footwear until you add some.</Notice>}

        <div className="flex flex-wrap items-center gap-3">
          {busy ? (
            <Button size="lg" variant="secondary" onClick={stop}>
              <Square className="size-4 fill-current" /> Stop
            </Button>
          ) : (
            <Button size="lg" onClick={() => go()} disabled={!ready.ready || ai.text === null}>
              <Sparkles className="size-5" /> {run.outfits.length ? 'Style me again' : 'Style me'}
            </Button>
          )}
          {busy && (
            <span className="flex items-center gap-2 text-[14px] text-ink-2">
              <Spinner />
              {run.status === 'thinking' ? `Claude is going through your closet… ${elapsed ? `${elapsed}s` : ''}` : 'Laying out looks…'}
            </span>
          )}
        </div>
      </section>

      <div ref={results} className="flex scroll-mt-24 flex-col gap-5">
        {run.status === 'error' && <Notice tone="error">{run.error}</Notice>}
        {run.status === 'thinking' && !run.outfits.length && (
          <div className="grid gap-5 md:grid-cols-2" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="relative aspect-[5/4] overflow-hidden rounded-3xl bg-raised">
                <div className="shimmer absolute inset-0" />
              </div>
            ))}
          </div>
        )}
        {run.outfits.length > 0 && (
          <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
            {run.outfits.map((o, i) => {
              const key = o.itemIds.join('|')
              const m = marks[key] ?? {}
              return (
                <OutfitCard
                  key={key}
                  outfit={o}
                  index={i}
                  itemsById={itemsById}
                  onOpenItem={onOpenItem}
                  worn={m.worn}
                  saved={m.saved || alreadySaved(o)}
                  feedback={m.feedback}
                  onWear={() => wear(o, key)}
                  onSave={() => save(o, key)}
                  onFeedback={(kind, reason) => feedback(o, key, kind, reason)}
                />
              )
            })}
          </div>
        )}
        {run.status === 'done' && run.outfits.length > 0 && (
          <Button variant="secondary" className="self-center" onClick={() => go({ more: true })}>
            <RefreshCw className="size-4" /> Three more ideas
          </Button>
        )}
      </div>

      <FitCheck plan={plan} enabled={ai.images} />

      <PiecePicker open={pickerOpen} onClose={() => setPickerOpen(false)} items={items} onPick={(id) => setPlan({ mustInclude: id })} />
    </div>
  )
}
