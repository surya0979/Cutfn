import { useEffect, useMemo, useRef, useState } from 'react'
import { wardrobeGaps } from '../lib/ai.js'
import { addDays, daysBetween, formatDay, parseKey, toKey, todayKey } from '../lib/dates.js'
import { COLORS, GROUPS, colorHex, colorLabel, roleOf, typeOf } from '../lib/vocab.js'
import { ItemImage, ItemTile, OutfitBoard } from './Pieces.jsx'
import { Button, IconButton, Notice, PageTitle, Section, Spinner, Swatch } from './ui.jsx'

const GAPS_KEY = 'fitfn.gaps'
const readGaps = () => {
  try {
    return JSON.parse(localStorage.getItem(GAPS_KEY) ?? 'null')
  } catch {
    return null
  }
}

const MAIN = new Set(['full_body', 'base_top', 'suit'])

const PRESS = 'active:translate-x-[3px] active:translate-y-[3px]'

// Multicolour is four hard blocks, never a blend (same blocks as Swatch).
const MULTI = ['#c4282d', '#ecc94b', '#2f7d4f', '#2f63b8']

const pad2 = (n) => String(n).padStart(2, '0')

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
    <div className="flex min-w-0 flex-col border-4 border-ink">
      <div className="flex items-center justify-between gap-2 border-b-4 border-ink bg-page p-2">
        <IconButton label="Previous month" onClick={() => shift(-1)}>
          ←
        </IconButton>
        <span className="display min-w-0 text-center text-[28px] break-words lg:text-[36px]">{label}</span>
        <IconButton label="Next month" onClick={() => shift(1)} disabled={isCurrent}>
          →
        </IconButton>
      </div>
      {/* A hard grid: cells sit on the black board, 4px of ink between them. */}
      <div className="grid grid-cols-7 gap-1 bg-ink text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="meta py-1 text-page">
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
          const isSelected = selected === key
          const isToday = key === today
          // Today = a black day number. Selected = a 4px ink frame inside the cell and a black ✓
          // block, like a picked tile; the photo stays so you can see which fit you picked.
          return (
            <button
              key={key}
              type="button"
              disabled={future || !dayWears.length}
              onClick={() => onSelect(key === selected ? null : key)}
              aria-label={`${formatDay(key)}${dayWears.length ? `, ${dayWears.length} outfit${dayWears.length > 1 ? 's' : ''}` : ''}`}
              className="relative aspect-square overflow-hidden bg-page text-left text-ink"
            >
              {/* No photo: the piece's colour block only. Its type word can't fit a day cell. */}
              {lead && <ItemImage item={lead} className="absolute inset-0 size-full [&>span]:hidden" />}
              {isSelected && <span aria-hidden="true" className="pointer-events-none absolute inset-0 border-4 border-ink" />}
              <span
                className={`display absolute top-0 left-0 px-1 py-0.5 text-[15px] tnum ${isToday || isSelected ? 'bg-ink text-page' : lead ? 'bg-page text-ink' : ''} ${
                  future ? 'opacity-35' : ''
                }`}
              >
                {i + 1}
              </span>
              {isSelected && (
                <span aria-hidden="true" className="display absolute right-0 bottom-0 bg-ink px-1 pt-0.5 text-[16px] text-page">
                  ✓
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WearRow({ wear, itemsById, onDelete, onOpenItem }) {
  return (
    <li className="grid grid-cols-[112px_minmax(0,1fr)] items-stretch sm:grid-cols-[148px_minmax(0,1fr)]">
      {/* The board keeps its own frame; black fills below it when the text runs taller. */}
      <div className="min-w-0 bg-board">
        <OutfitBoard itemIds={wear.itemIds ?? []} itemsById={itemsById} onPieceClick={onOpenItem} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 border-4 border-l-0 border-ink px-3 pt-2.5 pb-1">
        <span className="meta">{formatDay(wear.date)}</span>
        {/* 0.95 (important: .display is unlayered) so a clamped third line can't peek out below. */}
        <span className="display line-clamp-2 text-[24px] leading-[0.95]! break-words sm:text-[28px]">{wear.title || 'Outfit'}</span>
        <span className="truncate text-[15px]">
          {(wear.itemIds ?? [])
            .map((id) => itemsById[id]?.name)
            .filter(Boolean)
            .join(' + ')}
        </span>
        <Button variant="ghost" size="sm" className="-ml-3 self-start bg-page" onClick={() => onDelete(wear)}>
          Remove
        </Button>
      </div>
    </li>
  )
}

/** One stat: a massive Impact numeral, the Courier label below. */
function Stat({ label, value, hint, accent = false, className = '' }) {
  const text = String(value)
  const pct = text.endsWith('%')
  const digits = pct ? text.slice(0, -1) : text
  // Massive even on a phone; longer numbers step down so they never burst their column.
  const size = digits.length >= 4 ? 'text-[clamp(64px,6vw,84px)]' : digits.length === 3 ? 'text-[clamp(80px,8vw,112px)]' : 'text-[clamp(96px,10vw,140px)]'
  return (
    <div className={`flex min-w-0 flex-col gap-3 bg-page px-4 pt-4 pb-5 ${className}`}>
      <span className={`display tnum ${size} ${accent ? 'text-accent' : 'text-ink'}`}>
        {digits}
        {pct && <span className="text-[0.5em]">%</span>}
      </span>
      <span className="text-[16px] font-bold tracking-[0.04em] uppercase">{label}</span>
      {hint && <span className="truncate text-[15px] text-muted">{hint}</span>}
    </div>
  )
}

/** The closet's colours as hard blocks, widest = most pieces, 4px of ink between. */
function Palette({ items }) {
  const counts = {}
  for (const i of items) for (const c of (i.colors ?? []).slice(0, 1)) counts[c] = (counts[c] ?? 0) + 1
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (!total) return null
  const order = COLORS.map((c) => c.value).filter((c) => counts[c])
  const top = [...order].sort((a, b) => counts[b] - counts[a]).slice(0, 5)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-20 gap-1 overflow-hidden border-4 border-ink bg-ink" role="img" aria-label={`Main colours: ${top.map((c) => `${colorLabel(c)} ${counts[c]}`).join(', ')}`}>
        {order.map((c) => {
          const hex = colorHex(c)
          const solid = hex.startsWith('#')
          return (
            <span
              key={c}
              title={`${colorLabel(c)}: ${counts[c]}`}
              style={{ flexGrow: counts[c], background: solid ? hex : undefined }}
              className={`min-w-[8px] ${solid ? '' : 'grid grid-cols-2'}`}
            >
              {!solid && MULTI.map((m) => <span key={m} style={{ background: m }} />)}
            </span>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {top.map((c) => (
          <span key={c} className="inline-flex items-center gap-2 text-[15px]">
            <Swatch color={c} size={20} />
            {colorLabel(c)} <span className="display text-[20px] tnum">{Math.round((counts[c] / total) * 100)}%</span>
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
    <ul className="flex flex-col gap-3">
      {rows.map((g) => (
        <li key={g.value} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3rem] items-center gap-3">
          <span className="truncate text-[15px] font-bold uppercase">{g.label}</span>
          <span className="block h-7 bg-ink" style={{ width: `${Math.max(4, (counts[g.value] / max) * 100)}%` }} />
          <span className="display text-right text-[28px] tnum">{counts[g.value]}</span>
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
  const showIntro = !data && status !== 'thinking'
  const showData = data && status !== 'thinking'
  return (
    // The closer, built like Rate my fit on Style me: a giant Impact band, then the ask offset below it.
    <section className="flex min-w-0 flex-col border-4 border-ink bg-page">
      <h2 className="display border-b-4 border-ink px-4 pt-5 pb-3 text-[clamp(56px,11vw,140px)] break-words sm:px-6">What to buy next</h2>
      <div className="p-4 sm:p-6">
        <div className="flex min-w-0 flex-col items-start gap-5 md:pl-10">
          {showIntro && (
            <p className="max-w-[46ch] text-[16px]">
              {tagged.length < 5 ? 'Add at least 5 pieces first. ' : ''}Claude finds the few affordable pieces that would unlock the most new outfits, plus new ways to wear what you ignore.
            </p>
          )}
          {status === 'thinking' ? (
            <Button variant="black" size="lg" onClick={() => ctl.current?.abort()}>
              Stop
            </Button>
          ) : (
            // Ask Claude is the History screen's one accent CTA. It is an outline while it can't be
            // pressed (a faded accent reads pink) and steps down to an outline once answered.
            <Button variant={data || tagged.length < 5 ? 'secondary' : 'primary'} size="lg" onClick={ask} disabled={tagged.length < 5}>
              {data ? 'Ask again' : 'Ask Claude'}
            </Button>
          )}
        </div>
      </div>

      {(status === 'thinking' || error || showData) && (
        <div className="flex flex-col gap-6 border-t-4 border-ink p-4 sm:p-6">
          {status === 'thinking' && (
            <p className="flex items-center gap-2 text-[15px] font-bold" role="status">
              <Spinner /> Claude is going through your closet. This takes up to a minute.
            </p>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          {showData && (
            <div className="flex flex-col gap-8">
              {data.summary && <p className="max-w-[60ch] text-[16px] md:ml-[12%]">{data.summary}</p>}
              <ol className="grid items-start gap-x-8 gap-y-6 md:grid-cols-2">
                {data.buy.map((b, i) => (
                  <li key={b.piece} className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t-4 border-ink pt-4 ${i % 2 ? 'md:mt-12' : ''}`}>
                    {/* Only the first number takes the accent. */}
                    <span className={`display row-span-3 text-[72px] tnum ${i === 0 ? 'text-accent' : 'text-ink'}`}>{pad2(i + 1)}</span>
                    <span className="display min-w-0 text-[26px] break-words">{b.piece}</span>
                    <span className="text-[15px]">{b.why}</span>
                    {/* Only when a paired piece still exists, so "Pairs with" never dangles. */}
                    {b.pairsWith.some((id) => itemsById[id]) && (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="meta">Pairs with</span>
                        {b.pairsWith.map((id) =>
                          itemsById[id] ? (
                            <button
                              key={id}
                              type="button"
                              onClick={() => onOpenItem(itemsById[id])}
                              title={itemsById[id].name}
                              className={`block size-12 shrink-0 overflow-hidden border-4 border-ink bg-page ${PRESS}`}
                            >
                              <ItemImage item={itemsById[id]} className="size-full" />
                            </button>
                          ) : null,
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {data.underused.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h3 className="display text-[32px] sm:text-[40px]">Wear what you already have</h3>
                  {data.underused.map((u) =>
                    itemsById[u.itemId] ? (
                      <div key={u.itemId} className="flex items-start gap-3 border-4 border-ink p-3">
                        <span className="block size-16 shrink-0 overflow-hidden border-4 border-ink">
                          <ItemImage item={itemsById[u.itemId]} className="size-full" />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                          <p className="text-[15px]">{u.idea}</p>
                          <Button size="sm" variant="secondary" onClick={() => onStyleItem(itemsById[u.itemId])}>
                            Style it <span aria-hidden="true">→</span>
                          </Button>
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** A horizontal run of framed tiles; every second one drops. */
const ROW = 'no-scrollbar -mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-2'
const drop = (i) => (i % 2 ? 'mt-8' : '')

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
    <div className="flex flex-col gap-10">
      <PageTitle sub="What you wore, and what your closet says about you.">History</PageTitle>

      {/* The stats: four massive numerals on a hard grid, uneven columns, every second one dropped. */}
      <section aria-label="Your numbers" className="grid gap-1 border-4 border-ink bg-ink md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,5fr)_minmax(0,4fr)]">
        <Stat label="Pieces" value={tagged.length} hint={`${items.filter((i) => i.laundry).length} in the wash`} />
        {/* Fits this month is the stats' one accent number. */}
        <Stat label="Fits this month" value={wornThisMonth} accent className="md:pt-16" />
        <Stat label="Worn in 30 days" value={`${rotation}%`} hint="of your closet" className="xl:pt-8" />
        <Stat label="Never worn" value={neverWorn.length} className="md:pt-16 xl:pt-20" />
      </section>

      <div className="grid items-start gap-10 md:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] md:gap-8">
        <Calendar wears={wears} itemsById={itemsById} month={month} setMonth={setMonth} selected={selected} onSelect={setSelected} />
        <Section
          className="md:mt-16"
          title={selected ? formatDay(selected) : 'Recently worn'}
          aside={
            selected ? (
              <Button variant="ghost" size="sm" className="bg-page" onClick={() => setSelected(null)}>
                Show all
              </Button>
            ) : null
          }
        >
          {wears.length === 0 ? (
            <div className="flex flex-col gap-2 border-4 border-ink px-4 py-6">
              <p className="display text-[44px]">Nothing logged yet</p>
              <p className="text-[16px]">Hit Wear today on a fit and it lands here, with every piece’s wear count updated.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {list.map((w) => (
                <WearRow key={w.id} wear={w} itemsById={itemsById} onDelete={remove} onOpenItem={onOpenItem} />
              ))}
            </ul>
          )}
          {!selected && wears.length > 8 && !showAll && (
            <Button variant="ghost" size="sm" className="-ml-3 self-start bg-page" onClick={() => setShowAll(true)}>
              Show all {wears.length}
            </Button>
          )}
        </Section>
      </div>

      {tagged.length > 0 && (
        <div className="grid items-start gap-12 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-8">
          <Section title="Your colours">
            <Palette items={tagged} />
          </Section>
          <Section title="What’s in there" className="md:mt-20">
            <Breakdown items={tagged} />
          </Section>
        </div>
      )}

      {mostWorn.length > 0 && (
        <Section title="Most worn">
          <ol className={ROW}>
            {mostWorn.map((i, n) => (
              <li key={i.id} className={`flex w-36 shrink-0 flex-col gap-1 sm:w-40 ${drop(n)}`}>
                <span className="display text-[44px] tnum sm:text-[56px]">{pad2(n + 1)}</span>
                <ItemTile item={i} onOpen={onOpenItem} />
              </li>
            ))}
          </ol>
        </Section>
      )}

      {resting.length > 0 && (
        <Section title="Waiting to be worn">
          <p className="-mt-2 text-[15px] md:ml-[30%]">
            {resting.length} piece{resting.length === 1 ? '' : 's'} not worn in 30 days or more.
          </p>
          <div className={ROW}>
            {resting.slice(0, 12).map((i, n) => (
              <div key={i.id} className={`flex w-36 shrink-0 flex-col gap-1 sm:w-40 ${drop(n)}`}>
                <ItemTile item={i} onOpen={onOpenItem} />
                <Button variant="secondary" size="sm" className="self-start" onClick={() => onStyleItem(i)}>
                  Style it <span aria-hidden="true">→</span>
                </Button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tagged.length > 0 && <Gaps items={items} itemsById={itemsById} settings={settings} ai={ai} onOpenItem={onOpenItem} onStyleItem={onStyleItem} />}
    </div>
  )
}
