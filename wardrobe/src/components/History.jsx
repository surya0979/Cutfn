import { CaretLeft, CaretRight, MagicWand, ShoppingBag, Stop, Trash } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { wardrobeGaps } from '../lib/ai.js'
import { addDays, daysBetween, formatDay, parseKey, toKey, todayKey } from '../lib/dates.js'
import { COLORS, GROUPS, colorHex, colorLabel, roleOf, typeOf } from '../lib/vocab.js'
import { ItemImage, OutfitBoard } from './Pieces.jsx'
import { Button, IconButton, Notice, PageTitle, Section, Spinner } from './ui.jsx'

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
    <div className="flex flex-col gap-3 rounded-sm bg-surface p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <IconButton label="Previous month" onClick={() => shift(-1)}>
          <CaretLeft weight="bold" className="size-5" />
        </IconButton>
        <span className="display pb-0.5 text-[28px]">{label}</span>
        <IconButton label="Next month" onClick={() => shift(1)} disabled={isCurrent}>
          <CaretRight weight="bold" className="size-5" />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="meta text-muted">
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
              className={`relative aspect-square overflow-hidden rounded-sm text-[12px] font-semibold tnum ${
                selected === key ? 'outline-[3px] outline-offset-1 outline-accent outline-solid' : ''
              } ${key === today && !dayWears.length ? 'border-[1.5px] border-accent' : ''} ${dayWears.length ? 'bg-raised' : 'bg-page/40'} ${future ? 'text-muted/40' : 'text-ink-2'}`}
            >
              {lead && <ItemImage item={lead} className="absolute inset-0 size-full" />}
              <span
                className={`absolute top-1 left-1 leading-none ${lead ? 'rounded-sm bg-page/85 px-1 py-0.5 text-ink' : ''} ${key === today ? 'text-accent-ink' : ''}`}
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
        <span className="meta text-muted">{formatDay(wear.date)}</span>
        <span className="display line-clamp-2 pb-0.5 text-[24px]">{wear.title || 'Outfit'}</span>
        <span className="truncate text-[13.5px] text-ink-2">
          {(wear.itemIds ?? [])
            .map((id) => itemsById[id]?.name)
            .filter(Boolean)
            .join(' + ')}
        </span>
        <button type="button" onClick={() => onDelete(wear)} className="meta mt-1 inline-flex items-center gap-1 self-start text-muted hover:text-critical">
          <Trash weight="bold" className="size-3.5" /> Remove
        </button>
      </div>
    </li>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-l-[3px] border-line pl-3">
      <span className="display text-[56px] tnum sm:text-[72px]">{value}</span>
      <span className="text-[14px] font-semibold text-ink">{label}</span>
      {hint && <span className="truncate text-[13px] text-muted">{hint}</span>}
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
      <div className="flex h-16 overflow-hidden rounded-sm ring-1 ring-line" role="img" aria-label={`Main colours: ${top.map((c) => `${colorLabel(c)} ${counts[c]}`).join(', ')}`}>
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
        <li key={g.value} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-[14px]">
          <span className="truncate font-semibold text-ink-2">{g.label}</span>
          <span className="flex items-center gap-2">
            <span className="block h-5 rounded-sm bg-accent" style={{ width: `${Math.max(4, (counts[g.value] / max) * 100)}%` }} />
            <span className="tnum font-bold text-ink">{counts[g.value]}</span>
          </span>
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
    <section className="flex flex-col gap-5 rounded-sm bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="display text-[44px] sm:text-[56px]">What to buy next</h2>
        {status === 'thinking' ? (
          <Button variant="secondary" onClick={() => ctl.current?.abort()}>
            <Stop weight="fill" className="size-4" /> Stop
          </Button>
        ) : (
          <Button variant={data ? 'secondary' : 'primary'} onClick={ask} disabled={tagged.length < 5}>
            <MagicWand weight="bold" className="size-4" /> {data ? 'Ask again' : 'Ask Claude'}
          </Button>
        )}
      </div>
      {!data && status !== 'thinking' && (
        <p className="max-w-[56ch] text-[15px] text-ink-2">
          {tagged.length < 5 ? 'Add at least 5 pieces first. ' : ''}Claude finds the few affordable pieces that would unlock the most new outfits, plus new ways to wear what you ignore.
        </p>
      )}
      {status === 'thinking' && (
        <p className="flex items-center gap-2 text-ink-2" role="status">
          <Spinner className="size-4 text-accent" /> Claude is going through your closet. This takes up to a minute.
        </p>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {data && status !== 'thinking' && (
        <div className="flex flex-col gap-6">
          {data.summary && <p className="max-w-[64ch] text-[16px] text-ink-2">{data.summary}</p>}
          <ol className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {data.buy.map((b, i) => (
              <li key={b.piece} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
                <span className="display row-span-3 pb-1 text-[48px] text-accent-ink tnum">{i + 1}</span>
                <span className="flex items-center gap-1.5 pt-1 text-[16px] font-bold">
                  <ShoppingBag weight="bold" className="size-4 shrink-0" /> {b.piece}
                </span>
                <span className="text-[14px] text-ink-2">{b.why}</span>
                {b.pairsWith.length > 0 && (
                  <span className="flex gap-1">
                    {b.pairsWith.map((id) =>
                      itemsById[id] ? (
                        <button key={id} type="button" onClick={() => onOpenItem(itemsById[id])} title={itemsById[id].name} className="overflow-hidden rounded-sm">
                          <ItemImage item={itemsById[id]} className="size-10" />
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
              <h3 className="condensed text-[17px]">Wear what you already have</h3>
              {data.underused.map((u) =>
                itemsById[u.itemId] ? (
                  <div key={u.itemId} className="flex items-center gap-3 rounded-sm bg-raised p-2 pr-3">
                    <ItemImage item={itemsById[u.itemId]} className="size-14 shrink-0 rounded-sm" />
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
    </section>
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
    <div className="flex flex-col gap-10">
      <PageTitle sub="What you wore, and what your closet says about you.">History</PageTitle>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
        <Stat label="Pieces" value={tagged.length} hint={`${items.filter((i) => i.laundry).length} in the wash`} />
        <Stat label="Fits this month" value={wornThisMonth} />
        <Stat label="Worn in 30 days" value={`${rotation}%`} hint="of your closet" />
        <Stat label="Never worn" value={neverWorn.length} />
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Calendar wears={wears} itemsById={itemsById} month={month} setMonth={setMonth} selected={selected} onSelect={setSelected} />
        <Section
          title={selected ? formatDay(selected) : 'Recently worn'}
          aside={
            selected ? (
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Show all
              </Button>
            ) : null
          }
        >
          {wears.length === 0 ? (
            <p className="text-[15px] text-ink-2">Nothing logged yet. Hit Wear today on a fit and it lands here, with every piece’s wear count updated.</p>
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
        <div className="grid gap-10 lg:grid-cols-2">
          <Section title="Your colours">
            <Palette items={tagged} />
          </Section>
          <Section title="What’s in there">
            <Breakdown items={tagged} />
          </Section>
        </div>
      )}

      {mostWorn.length > 0 && (
        <Section title="Most worn">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {mostWorn.map((i) => (
              <button key={i.id} type="button" onClick={() => onOpenItem(i)} className="group flex w-32 shrink-0 flex-col gap-2 text-left">
                <span className="relative block overflow-hidden rounded-sm">
                  <ItemImage item={i} className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.04]" />
                  <span className="hangtag absolute top-2 left-2 tnum">{i.wearCount}×</span>
                </span>
                <span className="truncate text-[14px] font-bold">{i.name}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {resting.length > 0 && (
        <Section title="Waiting to be worn">
          <p className="-mt-2 text-[14px] text-muted">{resting.length} piece{resting.length === 1 ? '' : 's'} not worn in 30 days or more.</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {resting.slice(0, 12).map((i) => (
              <div key={i.id} className="flex w-32 shrink-0 flex-col gap-2">
                <button type="button" onClick={() => onOpenItem(i)} className="overflow-hidden rounded-sm text-left">
                  <ItemImage item={i} className="aspect-[4/5] w-full" />
                </button>
                <span className="truncate text-[14px] font-bold">{i.name}</span>
                <button type="button" onClick={() => onStyleItem(i)} className="condensed inline-flex items-center gap-1 self-start text-[13px] text-accent-ink hover:underline">
                  <MagicWand weight="bold" className="size-3.5" /> Style it
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
