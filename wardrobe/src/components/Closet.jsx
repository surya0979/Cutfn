import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, GROUPS, typeOf } from '../lib/vocab.js'
import { ItemTile } from './Pieces.jsx'
import { Button, Chip, IconButton, inputClass, Notice, PageTitle, Spinner } from './ui.jsx'

const SORTS = [
  { value: 'new', label: 'Newest' },
  { value: 'most', label: 'Most worn' },
  { value: 'least', label: 'Least worn' },
  { value: 'colour', label: 'By colour' },
]

const colorRank = Object.fromEntries(COLORS.map((c, i) => [c.value, i]))

function matches(item, q) {
  if (!q) return true
  const hay = [item.name, item.category, typeOf(item.category).label, item.subtype, item.brand, item.material, item.pattern, ...(item.colors ?? []), ...(item.styles ?? []), item.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word))
}

/** A hidden file picker; returns [input, open]. */
export function usePhotoPicker(onFiles, { multiple = true } = {}) {
  const ref = useRef(null)
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple={multiple}
      className="hidden"
      onChange={(e) => {
        if (e.target.files?.length) onFiles(e.target.files)
        e.target.value = ''
      }}
    />
  )
  return [input, () => ref.current?.click()]
}

// Deliberate misalignment: every second tile in a row drops. Phones (2 cols)
// drop the right tile, md (3 cols) drops the middle one, lg (4 cols) drops the
// 2nd and 4th. One class per breakpoint per tile, so nothing fights.
const stagger = (i) => `min-w-0 ${i % 2 ? 'mt-8 lg:mt-12' : 'mt-0 lg:mt-0'} ${i % 3 === 1 ? 'md:mt-12' : 'md:mt-0'}`

const GRID = 'grid grid-cols-2 items-start gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4'

const TIPS = [
  { n: '01', title: 'One piece per photo', line: 'Nothing else in the frame.', place: '' },
  { n: '02', title: 'Daylight beats flash', line: 'A window keeps the colours true.', place: 'md:mt-12' },
  { n: '03', title: 'Shoes and bags count', line: 'They finish the fit. Add them too.', place: 'md:col-start-1 md:ml-16' },
]

function EmptyCloset({ onAdd, canTag }) {
  return (
    <div className="slam flex flex-col gap-8">
      <h2 className="display min-w-0 text-[clamp(64px,13vw,150px)] break-words">Nothing in here yet</h2>

      <div className="flex flex-col items-start gap-5 md:ml-[38%]">
        <p className="max-w-[46ch] text-[16px]">
          Snap each piece on its own, on the bed, the floor or a hanger.
          {canTag ? ' Claude tags the type, colours and fabric, then builds outfits from what you actually own.' : ' Tag each one, then build outfits from what you actually own.'}
        </p>
        <Button variant="primary" size="lg" onClick={onAdd}>
          <span aria-hidden="true">+</span> Add your first pieces
        </Button>
      </div>

      <ol className="grid items-start gap-4 border-t-4 border-ink pt-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {TIPS.map((t) => (
          <li key={t.n} className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-4 border-4 border-ink p-4 ${t.place}`}>
            <span className="display text-[72px] tnum">{t.n}</span>
            <span className="flex min-w-0 flex-col gap-2 pt-1">
              <span className="display text-[30px] break-words">{t.title}</span>
              <span className="text-[15px]">{t.line}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function Closet({ items, ready, uploader, canTag, onOpenItem, onStyle, onLaundryClean }) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('all')
  const [sort, setSort] = useState('new')
  const [dragging, setDragging] = useState(false)
  const [picker, openPicker] = usePhotoPicker(uploader.addPhotos)

  // Paste photos straight in (desktop: copy an image, press Ctrl/⌘+V).
  const { addPhotos } = uploader
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (files.length && !/input|textarea/i.test(document.activeElement?.tagName ?? '')) {
        e.preventDefault()
        addPhotos(files)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addPhotos])

  const failedCount = items.filter((i) => i.aiStatus === 'failed').length

  const counts = useMemo(() => {
    const c = { all: items.length, favorites: 0, laundry: 0 }
    for (const i of items) {
      if (i.favorite) c.favorites += 1
      if (i.laundry) c.laundry += 1
      const g = i.category ? typeOf(i.category).group : null
      if (g) c[g] = (c[g] ?? 0) + 1
    }
    return c
  }, [items])

  const shown = useMemo(() => {
    let list = items.filter((i) => matches(i, q.trim()))
    if (group === 'favorites') list = list.filter((i) => i.favorite)
    else if (group === 'laundry') list = list.filter((i) => i.laundry)
    else if (group !== 'all') list = list.filter((i) => i.category && typeOf(i.category).group === group)
    const sorted = [...list]
    if (sort === 'most') sorted.sort((a, b) => (b.wearCount ?? 0) - (a.wearCount ?? 0))
    if (sort === 'least') sorted.sort((a, b) => (a.wearCount ?? 0) - (b.wearCount ?? 0) || (a.lastWorn ?? '').localeCompare(b.lastWorn ?? ''))
    if (sort === 'colour') sorted.sort((a, b) => (colorRank[a.colors?.[0]] ?? 99) - (colorRank[b.colors?.[0]] ?? 99))
    return sorted
  }, [items, q, group, sort])

  const chips = [
    { value: 'all', label: 'All' },
    ...GROUPS.filter((g) => counts[g.value]),
    ...(counts.favorites ? [{ value: 'favorites', label: 'Favourites' }] : []),
    ...(counts.laundry ? [{ value: 'laundry', label: 'In the wash' }] : []),
  ]
  const activeGroup = chips.some((c) => c.value === group) ? group : 'all'
  const clean = items.filter((i) => i.category && !i.laundry).length

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer?.files?.length) uploader.addPhotos(e.dataTransfer.files)
  }

  return (
    <div
      className="relative flex flex-col gap-8"
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types ?? [])].includes('Files')) {
          e.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={onDrop}
    >
      {picker}

      {/* Hero: the count is the section's one accent number, Add photos the screen's one accent CTA. */}
      <PageTitle
        count={ready && items.length ? items.length : null}
        sub={ready && items.length ? (counts.laundry ? `${counts.laundry} in the wash, ${clean} ready to wear.` : `All ${clean} ready to wear.`) : null}
        aside={
          items.length > 0 && (
            <Button variant="primary" size="lg" onClick={openPicker} disabled={!ready}>
              <span aria-hidden="true">+</span> Add photos
            </Button>
          )
        }
      >
        Closet
      </PageTitle>

      {(uploader.adding > 0 || uploader.tagging > 0) && (
        <Notice tone="warn" className="flex items-center gap-3">
          <Spinner className="text-[18px]" />
          <span>
            {uploader.adding > 0 ? `Saving ${uploader.adding} photo${uploader.adding === 1 ? '' : 's'}…` : ''}
            {uploader.adding > 0 && uploader.tagging > 0 ? ' ' : ''}
            {uploader.tagging > 0 ? `Claude is tagging ${uploader.tagging} piece${uploader.tagging === 1 ? '' : 's'}. Keep this tab open.` : ''}
          </span>
        </Notice>
      )}
      {canTag && failedCount > 0 && uploader.tagging === 0 && uploader.adding === 0 && (
        <Notice tone="warn" className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {failedCount} piece{failedCount > 1 ? 's' : ''} still need{failedCount > 1 ? '' : 's'} tags.
          </span>
          <Button size="sm" variant="secondary" onClick={() => uploader.retagFailed(items.filter((i) => i.aiStatus === 'failed'))}>
            Retry tagging
          </Button>
        </Notice>
      )}
      {uploader.errors.length > 0 && (
        <Notice tone="error" className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {uploader.errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
          <IconButton label="Dismiss" onClick={uploader.clearErrors}>
            ×
          </IconButton>
        </Notice>
      )}

      {!ready ? (
        <div className={GRID} aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={`${stagger(i)} blink flex flex-col border-4 border-ink`} style={{ animationDelay: `${(i % 4) * 225}ms` }}>
              <div className="aspect-[4/5] border-b-4 border-ink bg-raised" />
              <div className="flex flex-col gap-2 px-2 pt-2 pb-2.5">
                <div className="h-5 w-2/3 bg-ink" />
                <div className="h-3 w-1/3 bg-raised" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyCloset onAdd={openPicker} canTag={canTag} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] md:gap-4">
              <label className="min-w-0">
                <span className="sr-only">Search your closet</span>
                <input id="closet-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={inputClass} />
              </label>
              <label className="group relative min-w-0">
                <span className="sr-only">Sort</span>
                <select id="closet-sort" value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputClass} pr-10 font-bold uppercase`}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true" className="display pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[20px] group-hover:text-page">
                  ↓
                </span>
              </label>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {chips.map((c) => (
                <Chip key={c.value} active={activeGroup === c.value} onClick={() => setGroup(c.value)}>
                  {c.label}
                  <span className="tnum opacity-70">{counts[c.value] ?? 0}</span>
                </Chip>
              ))}
            </div>
          </div>

          {activeGroup === 'laundry' && counts.laundry > 0 && (
            <Notice className="flex flex-wrap items-center justify-between gap-3">
              <p>Pieces in the wash are left out of outfit ideas.</p>
              <Button size="sm" variant="secondary" onClick={() => onLaundryClean(items.filter((i) => i.laundry).map((i) => i.id))}>
                All clean
              </Button>
            </Notice>
          )}

          {/* The work tiles: staggered on purpose. */}
          <div className={GRID}>
            {shown.map((item, i) => (
              <div key={item.id} className={stagger(i)}>
                <ItemTile item={item} index={i} onOpen={onOpenItem} />
              </div>
            ))}
          </div>
          {shown.length === 0 && (
            <div className="flex flex-col gap-2 border-4 border-ink px-4 py-6 md:mr-[30%]">
              <p className="display text-[44px]">Nothing matches</p>
              <p className="text-[16px]">Try another word or filter.</p>
            </div>
          )}

          {/* The closer: one giant line, one clickable thing. Black: the accent belongs to Add photos. */}
          {items.length >= 3 && activeGroup === 'all' && !q && (
            <section className="mt-6 flex flex-col gap-6 border-t-4 border-ink pt-6">
              <h2 className="display min-w-0 text-[clamp(56px,12vw,160px)] break-words">What’s the fit today?</h2>
              <div className="flex flex-col items-start gap-4 md:ml-[42%]">
                <p className="text-[16px]">Claude picks from your {clean} clean pieces.</p>
                <Button variant="black" size="lg" onClick={onStyle}>
                  Build my fit →
                </Button>
              </div>
            </section>
          )}
        </>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-scrim p-4">
          <div className="border-4 border-ink bg-page px-6 py-6 sm:px-10 sm:py-8">
            <p className="display text-[clamp(56px,10vw,120px)]">Drop to add</p>
          </div>
        </div>
      )}
    </div>
  )
}
