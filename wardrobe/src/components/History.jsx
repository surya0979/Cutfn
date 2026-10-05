import { ChevronLeft, ChevronRight, ShoppingBag, Sparkles, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { wardrobeGaps } from '../lib/ai.js'
import { addDays, daysBetween, formatDay, parseKey, toKey, todayKey } from '../lib/dates.js'
import { COLORS, GROUPS, colorHex, colorLabel, roleOf, typeOf } from '../lib/vocab.js'
import { ItemImage, OutfitBoard } from './Pieces.jsx'
import { Button, Notice, Section, Spinner } from './ui.jsx'

const GAPS_KEY = 'fitfn.gaps'
const readGaps = () => {
  try {
    return JSON.parse(localStorage.getItem(GAPS_KEY) ?? 'null')
  } catch {
    return null
  }
}

const MAIN = new Set(['full_body', 'base_top', 'suit'])

function Calendar({ wears, itemsById, month, setMonth, selected, onSelect }) {
  const today = todayKey()
  const first = parseKey(`${month}-01`)
  const startPad = (first.getDay() + 6) % 7 // Monday first
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const byDay = useMemo(() => {
    const map = {}
    for (const w of wears) (map[w.date] ??= []).push(w)
    return map
  }, [wears])
  const shift = (n) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1)
    setMonth(toKey(d).slice(0, 7))
  }
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const isCurrent = month === today.slice(0, 7)

  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-surface p-3 shadow-card sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-raised">
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-display text-[20px] font-semibold">{label}</span>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} disabled={isCurrent} className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-raised disabled:opacity-30">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="label text-muted">
            {d}
          </span>
        ))}
        {Array.from({ length: startPad }, (_, i) => (
          <span key={`pad${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, '0')}`
          const dayWears = byDay[key] ?? []
          const lead = dayWears[0]?.itemIds?.map((id) => itemsById[id]).find((it) => it && MAIN.has(roleOf(it.category))) ?? itemsById[dayWears[0]?.itemIds?.[0]]
          const future = key > today
          return (
            <button
              key={key}
              type="button"
              disabled={future || !dayWears.length}
              onClick={() => onSelect(key === selected ? null : key)}
              aria-label={`${formatDay(key)}${dayWears.length ? `, ${dayWears.length} outfit${dayWears.length > 1 ? 's' : ''}` : ''}`}
              className={`relative aspect-square overflow-hidden rounded-lg text-[12px] tnum transition-shadow ${
                selected === key ? 'ring-2 ring-accent' : ''
              } ${dayWears.length ? 'bg-raised' : ''} ${future ? 'text-muted/50' : 'text-ink-2'}`}
            >
              {lead && <ItemImage item={lead} className="absolute inset-0 size-full" />}
              <span
                className={`absolute top-0.5 left-1 leading-none ${lead ? 'rounded bg-surface/90 px-1 py-0.5 text-ink' : ''} ${key === today ? 'font-bold text-accent-ink' : ''}`}
              >
                {i + 1}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WearRow({ wear, itemsById, onDelete, onOpenItem }) {
  return (
    <li className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
      <OutfitBoard itemIds={wear.itemIds ?? []} itemsById={itemsById} size="sm" onPieceClick={onOpenItem} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="label text-muted">{formatDay(wear.date)}</span>
        <span className="truncate font-display text-[18px] leading-snug font-semibold italic">{wear.title || 'Outfit'}</span>
        <span className="truncate text-[13.5px] text-ink-2">
          {(wear.itemIds ?? [])
            .map((id) => itemsById[id]?.name)
            .filter(Boolean)
            .join(' + ')}
        </span>
        <button type="button" onClick={() => onDelete(wear)} className="label mt-1 inline-flex items-center gap-1 self-start text-muted hover:text-critical">
          <Trash2 className="size-3.5" /> Remove
        </button>
      </div>
    </li>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-surface px-4 py-3 shadow-card">
      <span className="label text-muted">{label}</span>
      <span className="font-display text-[30px] leading-none font-semibold tnum">{value}</span>
      {hint && <span className="truncate text-[12.5px] text-muted">{hint}</span>}
    </div>
  )
}

/** The closet's colours as a woven strip, widest = most pieces. */
function Palette({ items }) {
  const counts = {}
  for (const i of items) for (const c of (i.colors ?? []).slice(0, 1)) counts[c] = (counts[c] ?? 0) + 1
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (!total) return null
  const order = COLORS.map((c) => c.value).filter((c) => counts[c])
  const top = [...order].sort((a, b) => counts[b] - counts[a]).slice(0, 5)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-12 overflow-hidden rounded-xl ring-1 ring-line" role="img" aria-label={`Main colours: ${top.map((c) => `${colorLabel(c)} ${counts[c]}`).join(', ')}`}>
        {order.map((c) => (
          <span key={c} title={`${colorLabel(c)}: ${counts[c]}`} style={{ flexGrow: counts[c], background: colorHex(c) }} className="min-w-[6px]" />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {top.map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-2">
            <span className="size-3 rounded-full ring-1 ring-ink/20" style={{ background: colorHex(c) }} />
            {colorLabel(c)} <span className="tnum text-muted">{Math.round((counts[c] / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function Breakdown({ items }) {
  const counts = {}
  for (const i of items) if (i.category) counts[typeOf(i.category).group] = (counts[typeOf(i.category).group] ?? 0) + 1
  const max = Math.max(1, ...Object.values(counts))
  const rows = GROUPS.filter((g) => counts[g.value])
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((g) => (
        <li key={g.value} className="grid grid-cols-[110px_minmax(0,1fr)_32px] items-center gap-3 text-[14px]">
          <span className="truncate text-ink-2">{g.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-raised">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(counts[g.value] / max) * 100}%` }} />
          </span>
          <span className="text-right tnum text-muted">{counts[g.value]}</span>
        </li>
      ))}
    </ul>
  )
}

function Gaps({ items, itemsById, settings, ai, onOpenItem, onStyleItem }) {
  const [state, setState] = useState(() => ({ status: 'idle', data: readGaps() }))
  const ctl = useRef(null)
  useEffect(() => () => ctl.current?.abort(), [])
  if (ai.text === false) return null
  const tagged = items.filter((i) => i.category)

  const ask = async () => {
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setState((s) => ({ ...s, status: 'thinking', error: null }))
    try {
      const data = await wardrobeGaps({ items: tagged, settings, today: todayKey(), signal: c.signal })
      try {
        localStorage.setItem(GAPS_KEY, JSON.stringify(data))
      } catch {
        /* per-device convenience only */
      }
      setState({ status: 'done', data })
    } catch (err) {
      setState((s) => ({ ...s, status: err.code === 'cancelled' ? 'idle' : 'error', error: err.code === 'cancelled' ? null : err.message }))
    }
  }

  const { data, status, error } = state
  return (
    <Section
      title="What to buy next"
      aside={
        status === 'thinking' ? (
          <Button size="sm" variant="secondary" onClick={() => ctl.current?.abort()}>
            <Square className="size-3.5 fill-current" /> Stop
          </Button>
        ) : (
          <Button size="sm" variant={data ? 'secondary' : 'primary'} onClick={ask} disabled={tagged.length < 5}>
            <Sparkles className="size-4" /> {data ? 'Ask again' : 'Ask Claude'}
          </Button>
        )
      }
    >
      {!data && status !== 'thinking' && (
        <p className="text-ink-2">
          {tagged.length < 5 ? 'Add at least 5 pieces, then' : ''} Claude looks for the few affordable pieces that would unlock the most new outfits, and new ways to wear what you ignore.
        </p>
      )}
      {status === 'thinking' && (
        <p className="flex items-center gap-2 text-ink-2">
          <Spinner /> Claude is auditing your closet. This takes up to a minute.
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {data && status !== 'thinking' && (
        <div className="flex flex-col gap-4">
          {data.summary && <p className="text-[15px] text-ink-2">{data.summary}</p>}
          <ol className="grid gap-3 sm:grid-cols-2">
            {data.buy.map((b, i) => (
              <li key={b.piece} className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card">
                <span className="flex items-baseline gap-2">
                  <span className="label text-muted tnum">{i + 1}</span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ShoppingBag className="size-4 text-accent-ink" /> {b.piece}
                  </span>
                </span>
                <span className="text-[14px] text-ink-2">{b.why}</span>
                {b.pairsWith.length > 0 && (
                  <span className="flex -space-x-2">
                    {b.pairsWith.map((id) =>
                      itemsById[id] ? (
                        <button key={id} type="button" onClick={() => onOpenItem(itemsById[id])} title={itemsById[id].name} className="overflow-hidden rounded-full ring-2 ring-surface">
                          <ItemImage item={itemsById[id]} className="size-9" />
                        </button>
                      ) : null,
                    )}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {data.underused.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="label text-muted">Wear what you have</h3>
              {data.underused.map((u) =>
                itemsById[u.itemId] ? (
                  <div key={u.itemId} className="flex items-center gap-3 rounded-2xl bg-raised p-2 pr-3">
                    <ItemImage item={itemsById[u.itemId]} className="size-14 shrink-0 rounded-xl" />
                    <p className="min-w-0 flex-1 text-[14px]">{u.idea}</p>
                    <Button size="sm" variant="secondary" onClick={() => onStyleItem(itemsById[u.itemId])}>
                      Style it
                    </Button>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  )
}

export default function History({ wears, items, itemsById, settings, ai, actions, showToast, onOpenItem, onStyleItem }) {
  const today = todayKey()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState(null)
  const [showAll, setShowAll] = useState(false)

  const monthStart = `${today.slice(0, 7)}-01`
  const wornThisMonth = wears.filter((w) => w.date >= monthStart).length
  const tagged = items.filter((i) => i.category)
  const neverWorn = tagged.filter((i) => !i.wearCount)
  const resting = tagged
    .filter((i) => !i.laundry && (!i.lastWorn || daysBetween(i.lastWorn, today) >= 30))
    .sort((a, b) => (a.lastWorn ?? '').localeCompare(b.lastWorn ?? ''))
  const mostWorn = [...tagged].filter((i) => i.wearCount).sort((a, b) => b.wearCount - a.wearCount).slice(0, 6)
  const worn30 = new Set(wears.filter((w) => w.date >= addDays(today, -30)).flatMap((w) => w.itemIds ?? []))
  const rotation = tagged.length ? Math.round((tagged.filter((i) => worn30.has(i.id)).length / tagged.length) * 100) : 0

  const list = selected ? wears.filter((w) => w.date === selected) : showAll ? wears : wears.slice(0, 8)

  const remove = (wear) => {
    actions.deleteWear(wear)
    showToast({ message: 'Removed from history' })
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col">
        <h1 className="font-display text-[34px] leading-none font-semibold sm:text-[40px]">History</h1>
        <p className="label mt-2 text-muted">What you wore, and what your closet says about you</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pieces" value={tagged.length} hint={`${items.filter((i) => i.laundry).length} in the laundry`} />
        <Stat label="Outfits this month" value={wornThisMonth} />
        <Stat label="30-day rotation" value={`${rotation}%`} hint="of your closet worn" />
        <Stat label="Never worn" value={neverWorn.length} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Calendar wears={wears} itemsById={itemsById} month={month} setMonth={setMonth} selected={selected} onSelect={setSelected} />
        <Section
          title={selected ? formatDay(selected) : 'Recently worn'}
          aside={
            selected ? (
              <button type="button" onClick={() => setSelected(null)} className="label text-muted hover:text-ink">
                Show all
              </button>
            ) : null
          }
        >
          {wears.length === 0 ? (
            <p className="text-ink-2">Nothing logged yet. Tap “Wear today” on an outfit and it shows up here, with each piece’s wear count updated.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {list.map((w) => (
                <WearRow key={w.id} wear={w} itemsById={itemsById} onDelete={remove} onOpenItem={onOpenItem} />
              ))}
            </ul>
          )}
          {!selected && wears.length > 8 && !showAll && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll(true)}>
              Show all {wears.length}
            </Button>
          )}
        </Section>
      </div>

      {tagged.length > 0 && (
        <div className="grid gap-8 lg:grid-cols-2">
          <Section title="Your colours">
            <Palette items={tagged} />
          </Section>
          <Section title="What’s in the closet">
            <Breakdown items={tagged} />
          </Section>
        </div>
      )}

      {mostWorn.length > 0 && (
        <Section title="Most worn">
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {mostWorn.map((i) => (
              <button key={i.id} type="button" onClick={() => onOpenItem(i)} className="flex w-28 shrink-0 flex-col gap-1.5 text-left">
                <ItemImage item={i} className="aspect-[4/5] w-full rounded-xl" />
                <span className="truncate text-[13.5px] font-semibold">{i.name}</span>
                <span className="label text-muted tnum">{i.wearCount}× worn</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {resting.length > 0 && (
        <Section title="Waiting to be worn" aside={<span className="label text-muted tnum">{resting.length} not worn in 30+ days</span>}>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {resting.slice(0, 12).map((i) => (
              <div key={i.id} className="flex w-28 shrink-0 flex-col gap-1.5">
                <button type="button" onClick={() => onOpenItem(i)} className="text-left">
                  <ItemImage item={i} className="aspect-[4/5] w-full rounded-xl" />
                </button>
                <span className="truncate text-[13.5px] font-semibold">{i.name}</span>
                <button type="button" onClick={() => onStyleItem(i)} className="label inline-flex items-center gap-1 self-start text-accent-ink hover:underline">
                  <Sparkles className="size-3.5" /> Style it
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tagged.length > 0 && <Gaps items={items} itemsById={itemsById} settings={settings} ai={ai} onOpenItem={onOpenItem} onStyleItem={onStyleItem} />}
    </div>
  )
}
