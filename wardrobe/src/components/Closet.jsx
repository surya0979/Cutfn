import { ArrowRight, Camera, Dress, Hoodie, MagnifyingGlass, Pants, Plus, Sneaker, TShirt, WashingMachine, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, GROUPS, typeOf } from '../lib/vocab.js'
import { ItemTile } from './Pieces.jsx'
import { Button, Chip, inputClass, Notice, PageTitle, Spinner } from './ui.jsx'

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

const EMPTY_TILES = [
  { Icon: TShirt, bg: '#f4f4f0', fg: '#151515' },
  { Icon: Pants, bg: '#34477a', fg: '#f4f4f0' },
  { Icon: Sneaker, bg: '#ff6a1a', fg: '#151515' },
  { Icon: Hoodie, bg: '#6b6f35', fg: '#f4f4f0' },
  { Icon: Dress, bg: '#c69a1f', fg: '#151515' },
  { Icon: TShirt, bg: '#45474f', fg: '#f4f4f0' },
]

function EmptyCloset({ onAdd, canTag }) {
  return (
    <div className="rise grid items-center gap-8 rounded-sm bg-surface p-5 sm:p-8 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <div className="flex flex-col items-start gap-5">
        <h2 className="display text-[52px] sm:text-[72px]">
          Nothing
          <br />
          in here yet
        </h2>
        <p className="max-w-[46ch] text-[16px] text-ink-2">
          Snap each piece on its own, on the bed, the floor or a hanger.
          {canTag ? ' Claude tags the type, colours and fabric, then builds outfits from what you actually own.' : ' Tag each one, then build outfits from what you actually own.'}
        </p>
        <Button size="lg" onClick={onAdd}>
          <Camera weight="bold" className="size-5" /> Add your first pieces
        </Button>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-muted">
          <li>One piece per photo</li>
          <li>Daylight beats flash</li>
          <li>Shoes and bags count</li>
        </ul>
      </div>
      <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
        {EMPTY_TILES.map(({ Icon, bg, fg }, i) => (
          <div key={i} className="rise flex aspect-[4/5] items-center justify-center rounded-sm" style={{ background: bg, color: fg, animationDelay: `${120 + i * 60}ms` }}>
            <Icon weight="duotone" className="size-1/2" />
          </div>
        ))}
      </div>
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
      className="relative flex flex-col gap-6"
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

      <PageTitle
        count={ready && items.length ? items.length : null}
        sub={ready && items.length ? (counts.laundry ? `${counts.laundry} in the wash, ${clean} ready to wear.` : `All ${clean} ready to wear.`) : null}
        aside={
          items.length > 0 && (
            <Button onClick={openPicker} disabled={!ready}>
              <Plus weight="bold" className="size-4" /> Add photos
            </Button>
          )
        }
      >
        Closet
      </PageTitle>

      {(uploader.adding > 0 || uploader.tagging > 0) && (
        <Notice className="flex items-center gap-3">
          <Spinner className="size-4 text-accent" />
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
          <button type="button" aria-label="Dismiss" onClick={uploader.clearErrors} className="text-muted hover:text-ink">
            <X weight="bold" className="size-4" />
          </button>
        </Notice>
      )}

      {!ready ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-raised">
                <div className="shimmer absolute inset-0" />
              </div>
              <div className="h-4 w-2/3 rounded-sm bg-raised" />
              <div className="h-3 w-1/3 rounded-sm bg-raised" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyCloset onAdd={openPicker} canTag={canTag} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search your closet</span>
                <MagnifyingGlass weight="bold" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  id="closet-search"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  className={`${inputClass} pl-9`}
                />
              </label>
              <label className="shrink-0">
                <span className="sr-only">Sort</span>
                <select id="closet-sort" value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputClass} w-auto pr-8 font-semibold`}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {chips.map((c) => (
                <Chip key={c.value} active={activeGroup === c.value} onClick={() => setGroup(c.value)}>
                  {c.label}
                  <span className={`tnum text-[12px] font-medium ${activeGroup === c.value ? 'text-page/70' : 'text-muted'}`}>{counts[c.value] ?? 0}</span>
                </Chip>
              ))}
            </div>
          </div>

          {activeGroup === 'laundry' && counts.laundry > 0 && (
            <Notice className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2">
                <WashingMachine weight="bold" className="size-4 shrink-0" /> Pieces in the wash are left out of outfit ideas.
              </p>
              <Button size="sm" variant="secondary" onClick={() => onLaundryClean(items.filter((i) => i.laundry).map((i) => i.id))}>
                All clean
              </Button>
            </Notice>
          )}

          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {activeGroup === 'all' && !q && (
              <button
                type="button"
                onClick={openPicker}
                className="group flex aspect-[4/5] flex-col items-start justify-between rounded-sm border-[1.5px] border-dashed border-line p-3 text-left text-ink-2 transition-colors hover:border-accent hover:text-ink"
              >
                <span className="flex size-10 items-center justify-center rounded-sm bg-accent text-on-accent transition-transform group-hover:rotate-90">
                  <Plus weight="bold" className="size-5" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="display text-[28px]">Add photos</span>
                  <span className="text-[13px] text-muted">Tap, drop or paste</span>
                </span>
              </button>
            )}
            {shown.map((item, i) => (
              <ItemTile key={item.id} item={item} index={i} onOpen={onOpenItem} />
            ))}
          </div>
          {shown.length === 0 && <p className="py-8 text-center text-muted">Nothing matches. Try another word or filter.</p>}

          {items.length >= 3 && activeGroup === 'all' && !q && (
            <button
              type="button"
              onClick={onStyle}
              className="group mt-2 flex items-end justify-between gap-4 rounded-sm bg-accent px-5 pt-6 pb-5 text-left text-on-accent transition-transform active:translate-y-px sm:px-8 sm:pt-10 sm:pb-7"
            >
              <span className="flex min-w-0 flex-col gap-2">
                <span className="display text-[44px] sm:text-[72px]">What’s the fit today?</span>
                <span className="text-[15px] font-medium">Claude picks from your {clean} clean pieces.</span>
              </span>
              <ArrowRight weight="bold" className="size-9 shrink-0 transition-transform group-hover:translate-x-1 sm:size-12" />
            </button>
          )}
        </>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-scrim">
          <div className="rounded-sm border-t-[3px] border-accent bg-page px-8 py-6 text-center shadow-card">
            <p className="display text-[40px]">Drop to add</p>
          </div>
        </div>
      )}
    </div>
  )
}
