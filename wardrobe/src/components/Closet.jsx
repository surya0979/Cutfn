import { Camera, ImagePlus, Search, Sparkles, WashingMachine, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { COLORS, GROUPS, typeOf } from '../lib/vocab.js'
import GarmentGlyph from './GarmentGlyph.jsx'
import { ItemTile } from './Pieces.jsx'
import { Button, Chip, inputClass, Notice, Spinner } from './ui.jsx'

const SORTS = [
  { value: 'new', label: 'Newest' },
  { value: 'most', label: 'Most worn' },
  { value: 'least', label: 'Least worn' },
  { value: 'colour', label: 'Colour' },
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

function EmptyCloset({ onAdd, canTag }) {
  const examples = [
    { category: 'shirt', color: 'light-blue' },
    { category: 'jeans', color: 'indigo' },
    { category: 'sneakers', color: 'white' },
    { category: 'kurta', color: 'mustard' },
  ]
  return (
    <div className="rise flex flex-col items-center gap-6 rounded-3xl border border-dashed border-line bg-surface px-5 py-10 text-center">
      <div className="grid grid-cols-4 gap-2" aria-hidden="true">
        {examples.map((e) => (
          <div key={e.category} className="flex size-16 items-center justify-center rounded-2xl bg-raised sm:size-20">
            <GarmentGlyph category={e.category} color={e.color} className="size-11 sm:size-14" />
          </div>
        ))}
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="font-display text-[28px] leading-tight font-semibold">Your closet is empty</h2>
        <p className="text-ink-2">
          Photograph each piece on its own: laid on the bed or floor, or on a hanger against a wall.
          {canTag ? ' Claude tags the type, colours, fabric and vibe, then builds outfits from what you own.' : ' Then tag each one and build outfits from what you own.'}
        </p>
      </div>
      <Button size="lg" onClick={onAdd}>
        <Camera className="size-5" /> Add your first pieces
      </Button>
      <ul className="label flex flex-wrap justify-center gap-x-4 gap-y-1 text-muted">
        <li>One item per photo</li>
        <li>Daylight, plain background</li>
        <li>Shoes and bags count too</li>
      </ul>
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
    ...(counts.laundry ? [{ value: 'laundry', label: 'Laundry' }] : []),
  ]
  const activeGroup = chips.some((c) => c.value === group) ? group : 'all'

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer?.files?.length) uploader.addPhotos(e.dataTransfer.files)
  }

  return (
    <div
      className="relative flex flex-col gap-5"
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

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="font-display text-[34px] leading-none font-semibold sm:text-[40px]">Closet</h1>
          <p className="label mt-2 text-muted tnum">
            {ready ? `${items.length} piece${items.length === 1 ? '' : 's'}${counts.laundry ? ` · ${counts.laundry} in laundry` : ''}` : 'Loading…'}
          </p>
        </div>
        {items.length > 0 && (
          <Button onClick={openPicker} disabled={!ready}>
            <ImagePlus className="size-5" /> Add photos
          </Button>
        )}
      </div>

      {(uploader.adding > 0 || uploader.tagging > 0) && (
        <Notice className="flex items-center gap-3">
          <Spinner className="size-4 text-accent" />
          <span>
            {uploader.adding > 0 ? `Saving ${uploader.adding} photo${uploader.adding === 1 ? '' : 's'}…` : ''}
            {uploader.adding > 0 && uploader.tagging > 0 ? ' ' : ''}
            {uploader.tagging > 0 ? `Claude is tagging ${uploader.tagging} piece${uploader.tagging === 1 ? '' : 's'}. Keep this page open.` : ''}
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
            <X className="size-4" />
          </button>
        </Notice>
      )}

      {!ready ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-raised">
                <div className="shimmer absolute inset-0" />
              </div>
              <div className="h-4 w-2/3 rounded bg-raised" />
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
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  id="closet-search"
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search colour, fabric…"
                  className={`${inputClass} rounded-full pl-9`}
                />
              </label>
              <label className="shrink-0">
                <span className="sr-only">Sort</span>
                <select id="closet-sort" value={sort} onChange={(e) => setSort(e.target.value)} className={`${inputClass} w-auto rounded-full pr-8`}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {chips.map((c) => (
                <Chip key={c.value} active={activeGroup === c.value} onClick={() => setGroup(c.value)}>
                  {c.label}
                  <span className={`tnum text-[12px] ${activeGroup === c.value ? 'text-page/70' : 'text-muted'}`}>{counts[c.value] ?? 0}</span>
                </Chip>
              ))}
            </div>
          </div>

          {activeGroup === 'laundry' && counts.laundry > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-raised px-4 py-3">
              <p className="flex items-center gap-2 text-[14px] text-ink-2">
                <WashingMachine className="size-4" /> Pieces in the laundry are left out of outfit ideas.
              </p>
              <Button size="sm" variant="secondary" onClick={() => onLaundryClean(items.filter((i) => i.laundry).map((i) => i.id))}>
                Mark all clean
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {activeGroup === 'all' && !q && (
              <button
                type="button"
                onClick={openPicker}
                className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-ink-2 transition-colors hover:border-accent hover:text-accent-ink"
              >
                <ImagePlus className="size-7" />
                <span className="text-[14px] font-semibold">Add photos</span>
                <span className="label text-muted">or drop them here</span>
              </button>
            )}
            {shown.map((item) => (
              <ItemTile key={item.id} item={item} onOpen={onOpenItem} />
            ))}
          </div>
          {shown.length === 0 && <p className="py-8 text-center text-muted">Nothing matches. Try another word or filter.</p>}

          {items.length >= 3 && activeGroup === 'all' && !q && (
            <button
              type="button"
              onClick={onStyle}
              className="flex items-center justify-between gap-4 rounded-2xl bg-accent px-5 py-4 text-left text-on-accent transition-transform active:scale-[0.99]"
            >
              <span className="flex flex-col">
                <span className="font-display text-[20px] leading-tight font-semibold">What should I wear?</span>
                <span className="text-[14px] opacity-85">Tell Claude the plan and the weather; it picks from these {items.length} pieces.</span>
              </span>
              <Sparkles className="size-6 shrink-0" />
            </button>
          )}
        </>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-scrim">
          <div className="rounded-3xl bg-surface px-8 py-6 text-center shadow-card">
            <ImagePlus className="mx-auto size-8 text-accent-ink" />
            <p className="mt-2 font-semibold">Drop photos to add them</p>
          </div>
        </div>
      )}
    </div>
  )
}
