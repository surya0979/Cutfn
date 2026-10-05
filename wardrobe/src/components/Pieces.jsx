import { Heart, WashingMachine } from 'lucide-react'
import { useState } from 'react'
import { usePhotoUrl } from '../lib/store.js'
import { roleOf, typeLabel } from '../lib/vocab.js'
import GarmentGlyph from './GarmentGlyph.jsx'
import { Spinner, Swatches } from './ui.jsx'

/** A piece's photo (thumbnail by default), or its silhouette when there's none. */
export function ItemImage({ item, full = false, className = '', fit = 'cover' }) {
  const fullUrl = usePhotoUrl(full ? item : null)
  const src = full ? fullUrl : item?.thumb
  const [failed, setFailed] = useState(null)
  if (!item) return <div className={`bg-raised ${className}`} />
  if (!src || failed === src) {
    return (
      <div className={`flex items-center justify-center bg-raised ${className}`}>
        <GarmentGlyph category={item.category} color={item.colors?.[0]} className="size-3/5 max-h-28" />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={item.name || typeLabel(item.category)}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(src)}
      className={`bg-raised ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
    />
  )
}

/** One tile in the closet grid. */
export function ItemTile({ item, onOpen, selected, selectable = false }) {
  const pending = item.aiStatus === 'pending'
  const failed = item.aiStatus === 'failed'
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      className="group flex min-w-0 flex-col gap-2 text-left"
    >
      <div
        className={`relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-raised transition-shadow ${
          selected ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-page' : 'group-hover:shadow-card'
        }`}
      >
        <ItemImage item={item} className="size-full transition-transform duration-300 group-hover:scale-[1.03]" />
        {pending && (
          <div className="absolute inset-0 flex items-end">
            <div className="shimmer absolute inset-0" />
            <span className="label relative m-2 inline-flex items-center gap-1.5 rounded-full bg-surface/95 px-2.5 py-1 text-ink">
              <Spinner className="size-3" /> Tagging
            </span>
          </div>
        )}
        {failed && <span className="label absolute bottom-2 left-2 rounded-full bg-surface/95 px-2.5 py-1 text-warn">Needs tags</span>}
        <div className="absolute top-2 right-2 flex gap-1">
          {item.laundry && (
            <span title="In the laundry" className="flex size-7 items-center justify-center rounded-full bg-surface/95 text-ink-2">
              <WashingMachine className="size-4" aria-label="In the laundry" />
            </span>
          )}
          {item.favorite && (
            <span title="Favourite" className="flex size-7 items-center justify-center rounded-full bg-surface/95 text-selvedge">
              <Heart className="size-4 fill-current" aria-label="Favourite" />
            </span>
          )}
        </div>
        {selected && <span className="label absolute top-2 left-2 rounded-full bg-accent px-2 py-1 text-on-accent">Picked</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <span className="truncate text-[14.5px] leading-snug font-semibold">{pending ? 'New piece' : item.name || typeLabel(item.category)}</span>
        <span className="flex items-center gap-2 text-muted">
          <Swatches colors={item.colors} size={11} />
          <span className="label truncate">
            {item.category ? typeLabel(item.category) : '—'}
            {item.wearCount ? ` · ${item.wearCount}×` : ''}
          </span>
        </span>
      </div>
    </button>
  )
}

const MAIN_ROLES = new Set(['full_body', 'suit', 'base_top', 'bottom'])

/**
 * An outfit as a flat-lay: body pieces large on the left, layers, shoes and
 * accessories stacked on the right.
 */
export function OutfitBoard({ itemIds, itemsById, size = 'md', onPieceClick, className = '' }) {
  const items = itemIds.map((id) => itemsById[id]).filter(Boolean)
  const main = items.filter((i) => MAIN_ROLES.has(roleOf(i.category)))
  const side = items.filter((i) => !MAIN_ROLES.has(roleOf(i.category)))
  const left = main.length ? main : side.slice(0, 2)
  const right = main.length ? side : side.slice(2)
  const shownRight = right.slice(0, 4)
  const extra = right.length - shownRight.length
  const gap = size === 'sm' ? 'gap-1 p-1' : 'gap-1.5 p-1.5'
  const radius = size === 'sm' ? 'rounded-lg' : 'rounded-xl'
  const missingCount = itemIds.length - items.length

  // A plain function, not a component, so images aren't remounted on every render.
  const piece = (item) => {
    const img = <ItemImage item={item} className="size-full" />
    return onPieceClick ? (
      <button key={item.id} type="button" onClick={() => onPieceClick(item)} className={`relative min-h-0 flex-1 overflow-hidden ${radius}`} title={item.name}>
        {img}
      </button>
    ) : (
      <div key={item.id} className={`relative min-h-0 flex-1 overflow-hidden ${radius}`}>
        {img}
      </div>
    )
  }

  return (
    <div
      className={`grid aspect-[5/4] w-full max-w-full overflow-hidden ${size === 'sm' ? 'rounded-xl' : 'rounded-2xl'} bg-board ${gap} ${
        shownRight.length ? 'grid-cols-[3fr_2fr]' : 'grid-cols-1'
      } ${className}`}
    >
      <div className={`flex min-h-0 flex-col ${size === 'sm' ? 'gap-1' : 'gap-1.5'}`}>
        {left.map(piece)}
        {!left.length && (
          <div className={`flex flex-1 items-center justify-center bg-raised text-[13px] text-muted ${radius}`}>
            {missingCount ? 'Pieces deleted' : 'Empty'}
          </div>
        )}
      </div>
      {shownRight.length > 0 && (
        <div className={`flex min-h-0 flex-col ${size === 'sm' ? 'gap-1' : 'gap-1.5'}`}>
          {shownRight.map((item, i) => (
            <div key={item.id} className="relative flex min-h-0 flex-1">
              {piece(item)}
              {extra > 0 && i === shownRight.length - 1 && (
                <span className={`label pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/55 text-page ${radius}`}>+{extra}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
