import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { curateOutfits, fitCheck } from '../lib/ai.js'
import { todayKey } from '../lib/dates.js'
import { preparePhoto } from '../lib/images.js'
import { readiness, sameOutfit, summarizeOutfit } from '../lib/outfits.js'
import { OCCASIONS, TIMES, WEATHER, occasionLabel, typeLabel } from '../lib/vocab.js'
import { usePhotoPicker } from './Closet.jsx'
import OutfitCard from './OutfitCard.jsx'
import { ItemImage, ItemTile } from './Pieces.jsx'
import { Button, Chip, IconButton, inputClass, Notice, PageTitle, Section, Sheet, Spinner } from './ui.jsx'

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

/**
 * One question of the plan: a 4px rule, a Courier counter, the question in
 * Impact. Every second question steps right on wider screens (deliberate
 * misalignment); phones get one plain column. `asLabel` makes the heading the
 * label of the control, which then receives its id.
 */
function Question({ n, title, asLabel = false, offset = false, children }) {
  const id = useId()
  const Heading = asLabel ? 'label' : 'h2'
  return (
    <div className="grid gap-3 border-t-4 border-ink pt-4 md:grid-cols-[64px_minmax(0,1fr)] md:gap-4">
      <span className="meta text-muted md:pt-2">{n} / 04</span>
      <div className={`flex min-w-0 flex-col gap-4 ${offset ? 'md:pl-12' : ''}`}>
        <Heading htmlFor={asLabel ? id : undefined} className="display text-[30px] sm:text-[32px]">
          {title}
        </Heading>
        {typeof children === 'function' ? children(id) : children}
      </div>
    </div>
  )
}

function PiecePicker({ open, onClose, items, onPick }) {
  const [q, setQ] = useState('')
  const list = items.filter((i) => i.category && !i.laundry && (!q || `${i.name} ${typeLabel(i.category)}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <Sheet open={open} onClose={onClose} title="Build around a piece" wide>
      <div className="flex flex-col gap-5">
        <input id="pick-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your closet" className={inputClass} />
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 md:[&>:nth-child(3n+2)]:mt-8">
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
        {!list.length && (
          <div className="flex flex-col gap-2 border-4 border-ink px-4 py-6">
            <p className="display text-[32px]">Nothing matches</p>
            <p className="text-[16px]">Only clean, tagged pieces show up here.</p>
          </div>
        )}
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

  // The closer: a giant Impact line across a 4px box, the score its one red number.
  return (
    <section className="flex min-w-0 flex-col border-4 border-ink bg-page">
      {picker}
      <h2 className="display border-b-4 border-ink px-4 pt-5 pb-3 text-[clamp(56px,11vw,140px)] break-words sm:px-6">Rate my fit</h2>
      {/* Split from lg: at md the 5fr column is narrower than the lg button. */}
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        <div className="flex min-w-0 flex-col items-start gap-5 md:pl-10 lg:pt-6">
          <p className="max-w-[46ch] text-[16px]">Already dressed? Send a mirror pic for an honest score and two quick fixes. The photo goes to Claude and isn’t saved.</p>
          <Button variant="secondary" size="lg" onClick={open} disabled={status === 'thinking'}>
            {status === 'idle' ? 'Send a mirror pic' : 'Try another'}
          </Button>
        </div>
        {status !== 'idle' && (
          <div className="slam grid min-w-0 gap-4 md:grid-cols-[150px_minmax(0,1fr)] md:gap-6">
            {preview ? <img src={preview} alt="Your outfit" className="aspect-[3/4] w-[120px] border-4 border-ink object-cover md:w-full" /> : <div />}
            <div className="flex min-w-0 flex-col gap-3">
              {status === 'thinking' && (
                <p className="flex items-center gap-2 text-[15px] font-bold">
                  <Spinner /> Claude is looking…
                </p>
              )}
              {status === 'error' && <Notice tone="error">{error}</Notice>}
              {status === 'done' && result && (
                <>
                  {result.score != null && (
                    <p className="display text-[112px] text-accent tnum">
                      {result.score}
                      <span className="ml-1 text-[36px] text-ink">/10</span>
                    </p>
                  )}
                  <p className="display text-[28px] break-words">{result.verdict}</p>
                  <div className="flex flex-col gap-2 border-l-4 border-ink pl-4">
                    {result.good.map((g) => (
                      <p key={g} className="text-[15px]">
                        <span className="display mr-2 text-[22px]">Works:</span>
                        {g}
                      </p>
                    ))}
                    {result.tweaks.map((t) => (
                      <p key={t} className="text-[15px]">
                        <span className="display mr-2 text-[22px]">Try:</span>
                        {t}
                      </p>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
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
      <div className="flex flex-col gap-8">
        <PageTitle>Style me</PageTitle>
        <Notice>Outfit ideas come from Claude, which only works when this app is opened on claude.ai. Your closet, saved looks and history still work here.</Notice>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <PageTitle sub={`Tell Claude the plan. It builds the fit from your ${clean.length} clean piece${clean.length === 1 ? '' : 's'}.`}>Style me</PageTitle>

      {/* Questions on the left, the plan panel on the right: an uneven 7 / 4 split that drops the panel out of line. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <Question n="01" title="Where are you headed?">
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <Chip key={o.value} active={plan.occasion === o.value} onClick={() => setPlan({ occasion: o.value })}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </Question>

          <Question n="02" title="How hot is it?" offset>
            <div className="grid grid-cols-2 items-start gap-2 md:grid-cols-3 md:gap-3 md:[&>:nth-child(3n+2)]:mt-6">
              {WEATHER.map((w) => {
                const on = plan.weather === w.value
                return (
                  <button
                    key={w.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPlan({ weather: w.value })}
                    className={`flex min-w-0 flex-col items-start gap-2 border-4 border-ink px-3 pt-3.5 pb-2.5 text-left [container-type:inline-size] active:translate-x-[3px] active:translate-y-[3px] ${
                      on ? 'bg-ink text-page' : 'bg-page text-ink'
                    }`}
                  >
                    <span className="display text-[clamp(26px,30cqw,52px)] whitespace-nowrap tnum">{w.range.replace('under ', '<')}</span>{' '}
                    <span className={`text-[15px] font-bold ${on ? '' : 'text-muted'}`}>{w.label}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip active={plan.rain} onClick={() => setPlan({ rain: !plan.rain })}>
                Rain likely
              </Chip>
              <Chip active={plan.humid} onClick={() => setPlan({ humid: !plan.humid })}>
                Humid
              </Chip>
            </div>
          </Question>

          <Question n="03" title="When?">
            <div className="flex flex-wrap gap-2">
              {TIMES.map((t) => (
                <Chip key={t.value} active={plan.time === t.value} onClick={() => setPlan({ time: t.value })}>
                  {t.label}
                </Chip>
              ))}
            </div>
          </Question>

          <Question n="04" title="Anything else Claude should know?" asLabel offset>
            {(id) => (
              <textarea
                id={id}
                rows={3}
                value={plan.brief}
                onChange={(e) => setPlan({ brief: e.target.value })}
                placeholder="Cousin’s mehendi, lots of sitting on the floor. Want to look sharp but stay cool."
                className={inputClass}
                maxLength={300}
              />
            )}
          </Question>
        </div>

        <aside className="flex min-w-0 flex-col border-4 border-ink bg-page lg:sticky lg:top-24 lg:mt-16">
          <div className="flex flex-col gap-4 p-4">
            <span className="display text-[30px]">Build around a piece</span>
            {must ? (
              <div className="flex items-center border-4 border-ink">
                <ItemImage item={must} className="size-16 shrink-0 border-r-4 border-ink" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2">
                  <span className="display truncate text-[22px]">{must.name}</span>
                  <span className="text-[15px] text-muted">In every look</span>
                </div>
                <IconButton label="Remove" onClick={() => setPlan({ mustInclude: null })} className="mr-2">
                  ×
                </IconButton>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setPickerOpen(true)} disabled={!clean.length} className="w-full">
                <span aria-hidden="true">+</span> Pick one (optional)
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t-4 border-ink p-4">
            {!ready.ready && items.length > 0 && <Notice tone="warn">Add {ready.missing.join(' and ')} (or empty the wash) so Claude can build a full outfit.</Notice>}
            {ready.ready && ready.missing.includes('shoes') && <Notice>No shoes in your closet yet. Fits will skip footwear until you add some.</Notice>}

            {busy ? (
              <Button size="lg" variant="black" onClick={stop} className="w-full">
                Stop
              </Button>
            ) : (
              // The screen's one accent CTA, an outline until it can be pressed (a faded accent reads pink).
              <Button size="lg" variant={!ready.ready || ai.text === null ? 'secondary' : 'primary'} onClick={() => go()} disabled={!ready.ready || ai.text === null} className="w-full">
                {run.outfits.length ? 'Build new fits' : 'Build my fit'} <span aria-hidden="true">→</span>
              </Button>
            )}
            {busy && (
              <p className="flex items-center gap-2 text-[15px] font-bold" role="status">
                <Spinner />
                {run.status === 'thinking' ? `Claude is raiding your closet… ${elapsed ? `${elapsed}s` : ''}` : 'Laying out your fits…'}
              </p>
            )}
          </div>
        </aside>
      </div>

      <div ref={results} className="flex scroll-mt-24 flex-col gap-6">
        {run.status === 'error' && <Notice tone="error">{run.error}</Notice>}
        {(run.outfits.length > 0 || run.status === 'thinking') && (
          <Section title="Your fits" aside={<span className="meta text-muted">Ranked. Strongest first.</span>}>
            {run.status === 'thinking' && !run.outfits.length && (
              <div className="grid gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" aria-hidden="true">
                <div className="blink aspect-[5/4] border-4 border-ink bg-ink" />
                <div className="flex flex-col gap-3 md:pt-12">
                  <div className="blink h-20 w-28 border-4 border-ink bg-raised" />
                  <div className="blink h-12 border-4 border-ink bg-raised" />
                  <div className="blink h-12 w-3/4 border-4 border-ink bg-raised md:ml-8" />
                  <div className="blink h-12 w-1/2 border-4 border-ink bg-ink" />
                </div>
              </div>
            )}
            {run.outfits.length > 0 && (
              <div className="grid items-start gap-6 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:[&>:nth-child(2n+3)]:mt-12">
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
              <Button variant="secondary" size="lg" className="self-start" onClick={() => go({ more: true })}>
                <span aria-hidden="true">+</span> Three more fits
              </Button>
            )}
          </Section>
        )}
      </div>

      <FitCheck plan={plan} enabled={ai.images} />

      <PiecePicker open={pickerOpen} onClose={() => setPickerOpen(false)} items={items} onPick={(id) => setPlan({ mustInclude: id })} />
    </div>
  )
}
