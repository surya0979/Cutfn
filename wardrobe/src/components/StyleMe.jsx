import { ArrowRight, ArrowsClockwise, Camera, CloudRain, Drop, Plus, Stop, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { curateOutfits, fitCheck } from '../lib/ai.js'
import { todayKey } from '../lib/dates.js'
import { preparePhoto } from '../lib/images.js'
import { readiness, sameOutfit, summarizeOutfit } from '../lib/outfits.js'
import { OCCASIONS, TIMES, WEATHER, occasionLabel, typeLabel } from '../lib/vocab.js'
import { usePhotoPicker } from './Closet.jsx'
import OutfitCard from './OutfitCard.jsx'
import { ItemImage, ItemTile } from './Pieces.jsx'
import { Button, Chip, Field, IconButton, inputClass, Notice, PageTitle, Sheet, Spinner } from './ui.jsx'

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
        <input id="pick-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your closet" className={inputClass} />
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
    <section className="grid gap-5 rounded-sm border-[1.5px] border-line p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
      {picker}
      <div className="flex min-w-0 flex-col items-start gap-3">
        <h2 className="display text-[44px] sm:text-[56px]">Rate my fit</h2>
        <p className="max-w-[44ch] text-[15px] text-ink-2">Already dressed? Send a mirror pic for an honest score and two quick fixes. The photo goes to Claude and isn’t saved.</p>
        <Button variant="secondary" onClick={open} disabled={status === 'thinking'}>
          <Camera weight="bold" className="size-4" /> {status === 'idle' ? 'Send a mirror pic' : 'Try another'}
        </Button>
      </div>
      {status !== 'idle' && (
        <div className="rise grid grid-cols-[104px_minmax(0,1fr)] gap-4 sm:grid-cols-[132px_minmax(0,1fr)]">
          {preview ? <img src={preview} alt="Your outfit" className="aspect-[3/4] w-full rounded-sm object-cover" /> : <div />}
          <div className="flex min-w-0 flex-col gap-2.5">
            {status === 'thinking' && (
              <p className="flex items-center gap-2 text-ink-2">
                <Spinner className="size-4 text-accent" /> Claude is looking…
              </p>
            )}
            {status === 'error' && <p className="text-critical">{error}</p>}
            {status === 'done' && result && (
              <>
                {result.score != null && (
                  <p className="display text-[64px] text-accent-ink tnum">
                    {result.score}
                    <span className="text-[24px] text-muted">/10</span>
                  </p>
                )}
                <p className="condensed text-[17px]">{result.verdict}</p>
                {result.good.map((g) => (
                  <p key={g} className="text-[14px]">
                    <span className="font-bold text-good">Works: </span>
                    {g}
                  </p>
                ))}
                {result.tweaks.map((t) => (
                  <p key={t} className="text-[14px]">
                    <span className="font-bold text-accent-ink">Try: </span>
                    {t}
                  </p>
                ))}
              </>
            )}
          </div>
        </div>
      )}
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
      message: `Logged for today${toLaundry.length ? `. ${toLaundry.length} piece${toLaundry.length > 1 ? 's' : ''} into the wash` : ''}`,
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
    showToast({ message: kind === 'liked' ? 'Noted. More like this next time.' : 'Noted. Claude will steer clear.' })
  }

  const alreadySaved = (o) => looks.some((l) => sameOutfit(l.itemIds ?? [], o.itemIds))

  if (ai.text === false) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Style me</PageTitle>
        <Notice>Outfit ideas come from Claude, which only works when this app is opened on claude.ai. Your closet, saved looks and history still work here.</Notice>
      </div>
    )
  }

  const question = 'condensed text-[17px] text-ink'

  return (
    <div className="flex flex-col gap-8">
      <PageTitle sub={`Tell Claude the plan. It builds the fit from your ${clean.length} clean piece${clean.length === 1 ? '' : 's'}.`}>Style me</PageTitle>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-7">
          <div className="flex flex-col gap-3">
            <h2 className={question}>Where are you headed?</h2>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((o) => (
                <Chip key={o.value} active={plan.occasion === o.value} onClick={() => setPlan({ occasion: o.value })}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className={question}>How hot is it?</h2>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {WEATHER.map((w) => {
                const on = plan.weather === w.value
                return (
                  <button
                    key={w.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPlan({ weather: w.value })}
                    className={`flex flex-col items-start gap-1.5 rounded-sm border-[1.5px] px-2.5 pt-2.5 pb-2 text-left transition-colors active:translate-y-px ${
                      on ? 'border-accent bg-accent text-on-accent' : 'border-line text-ink hover:border-ink/50'
                    }`}
                  >
                    <span className="display text-[26px] tnum">{w.range.replace('under ', '<')}</span>
                    <span className={`text-[13px] font-semibold ${on ? '' : 'text-muted'}`}>{w.label}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip active={plan.rain} onClick={() => setPlan({ rain: !plan.rain })}>
                <CloudRain weight="bold" className="size-4" /> Rain likely
              </Chip>
              <Chip active={plan.humid} onClick={() => setPlan({ humid: !plan.humid })}>
                <Drop weight="bold" className="size-4" /> Humid
              </Chip>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className={question}>When?</h2>
            <div className="flex flex-wrap gap-1.5">
              {TIMES.map((t) => (
                <Chip key={t.value} active={plan.time === t.value} onClick={() => setPlan({ time: t.value })}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Anything else Claude should know?">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                value={plan.brief}
                onChange={(e) => setPlan({ brief: e.target.value })}
                placeholder="Cousin’s mehendi, lots of sitting on the floor. Want to look sharp but stay cool."
                className={inputClass}
                maxLength={300}
              />
            )}
          </Field>
        </div>

        <aside className="flex flex-col gap-4 rounded-sm bg-surface p-4 lg:sticky lg:top-24">
          <div className="flex flex-col gap-2">
            <span className={question}>Build around a piece</span>
            {must ? (
              <div className="flex items-center gap-3 rounded-sm bg-raised p-2 pr-2.5">
                <ItemImage item={must} className="size-14 shrink-0 rounded-sm" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold">{must.name}</span>
                  <span className="text-[13px] text-muted">In every look</span>
                </div>
                <IconButton label="Remove" onClick={() => setPlan({ mustInclude: null })}>
                  <X weight="bold" className="size-4" />
                </IconButton>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={!clean.length}
                className="flex items-center justify-center gap-2 rounded-sm border-[1.5px] border-dashed border-line px-4 py-3 text-[14px] font-semibold text-ink-2 hover:border-ink/50 hover:text-ink disabled:opacity-40"
              >
                <Plus weight="bold" className="size-4" /> Pick one (optional)
              </button>
            )}
          </div>

          {!ready.ready && items.length > 0 && <Notice tone="warn">Add {ready.missing.join(' and ')} (or empty the wash) so Claude can build a full outfit.</Notice>}
          {ready.ready && ready.missing.includes('shoes') && <Notice>No shoes in your closet yet. Fits will skip footwear until you add some.</Notice>}

          {busy ? (
            <Button size="lg" variant="secondary" onClick={stop} className="w-full">
              <Stop weight="fill" className="size-4" /> Stop
            </Button>
          ) : (
            <Button size="lg" onClick={() => go()} disabled={!ready.ready || ai.text === null} className="w-full">
              {run.outfits.length ? 'Build new fits' : 'Build my fit'} <ArrowRight weight="bold" className="size-5" />
            </Button>
          )}
          {busy && (
            <p className="flex items-center gap-2 text-[14px] text-ink-2" role="status">
              <Spinner className="size-4 text-accent" />
              {run.status === 'thinking' ? `Claude is raiding your closet… ${elapsed ? `${elapsed}s` : ''}` : 'Laying out your fits…'}
            </p>
          )}
        </aside>
      </div>

      <div ref={results} className="flex scroll-mt-24 flex-col gap-5">
        {run.status === 'error' && <Notice tone="error">{run.error}</Notice>}
        {(run.outfits.length > 0 || run.status === 'thinking') && <h2 className="display text-[44px] sm:text-[64px]">Your fits</h2>}
        {run.status === 'thinking' && !run.outfits.length && (
          <div className="grid gap-4 md:grid-cols-2" aria-hidden="true">
            <div className="relative aspect-[5/4] overflow-hidden rounded-sm bg-surface md:col-span-2 md:aspect-[16/7]">
              <div className="shimmer absolute inset-0" />
            </div>
          </div>
        )}
        {run.outfits.length > 0 && (
          <div className="grid items-start gap-4 md:grid-cols-2">
            {run.outfits.map((o, i) => {
              const key = o.itemIds.join('|')
              const m = marks[key] ?? {}
              return (
                <OutfitCard
                  key={key}
                  outfit={o}
                  index={i}
                  featured={i === 0}
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
          <Button variant="secondary" className="self-start" onClick={() => go({ more: true })}>
            <ArrowsClockwise weight="bold" className="size-4" /> Three more fits
          </Button>
        )}
      </div>

      <FitCheck plan={plan} enabled={ai.images} />

      <PiecePicker open={pickerOpen} onClose={() => setPickerOpen(false)} items={items} onPick={(id) => setPlan({ mustInclude: id })} />
    </div>
  )
}
