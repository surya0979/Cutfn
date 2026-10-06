import { Check, Heart, WashingMachine } from '@phosphor-icons/react'
import { useState } from 'react'
import { usePhotoUrl } from '../lib/store.js'
import { roleOf, typeLabel } from '../lib/vocab.js'
import GarmentIcon from './GarmentIcon.jsx'
import { Spinner, Swatches } from './ui.jsx'

/** A piece's photo (thumbnail by default), or its garment icon when there's none. */
export function ItemImage({ item, full = false, className = '', fit = 'cover' }) {
  const fullUrl = usePhotoUrl(full ? item : null)
  const src = full ? fullUrl : item?.thumb
  const [failed, setFailed] = useState(null)
  if (!item) return <div className={`bg-raised ${className}`} />
  if (!src || failed === src) {
    return <GarmentIcon category={item.category} color={item.colors?.[0]} className={className} iconClassName="size-2/5 max-h-24 max-w-24" />
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

/** One tile in the closet grid. The orange swing tag counts wears. */
export function ItemTile({ item, onOpen, selected, selectable = false, index = 0 }) {
  const pending = item.aiStatus === 'pending'
  const failed = item.aiStatus === 'failed'
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      className="group rise flex min-w-0 flex-col gap-2.5 text-left"
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
    >
      <div
        className={`relative aspect-[4/5] w-full overflow-hidden rounded-sm bg-raised outline-offset-2 transition-[outline-color] ${
          selected ? 'outline-[3px] outline-accent outline-solid' : 'outline-[3px] outline-transparent outline-solid group-hover:outline-line'
        }`}
      >
        <ItemImage item={item} className="size-full transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
        {pending && (
          <div className="absolute inset-0 flex items-end">
            <div className="shimmer absolute inset-0" />
            <span className="meta relative m-2 inline-flex items-center gap-1.5 rounded-sm bg-page/90 px-2 py-1 text-ink">
              <Spinner className="size-3 text-accent" /> Tagging
            </span>
          </div>
        )}
        {failed && <span className="meta absolute bottom-2 left-2 rounded-sm bg-page/90 px-2 py-1 text-warn">Needs tags</span>}
        {!pending && item.wearCount > 0 && (
          <span className="hangtag absolute top-2 left-2 tnum" title={`Worn ${item.wearCount} times`}>
            {item.wearCount}×
          </span>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          {item.laundry && (
            <span title="In the wash" className="flex size-7 items-center justify-center rounded-sm bg-page/90 text-ink">
              <WashingMachine weight="bold" className="size-4" aria-label="In the wash" />
            </span>
          )}
          {item.favorite && (
            <span title="Favourite" className="flex size-7 items-center justify-center rounded-sm bg-page/90 text-accent">
              <Heart weight="fill" className="size-4" aria-label="Favourite" />
            </span>
          )}
        </div>
        {selected && (
          <span className="absolute bottom-2 left-2 flex size-7 items-center justify-center rounded-sm bg-accent text-on-accent">
            <Check weight="bold" className="size-4" aria-label="Picked" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-[15px] leading-tight font-bold">{pending ? 'New piece' : item.name || typeLabel(item.category)}</span>
        <span className="flex min-w-0 items-center gap-2 text-muted">
          <Swatches colors={item.colors} size={10} />
          <span className="meta truncate">{item.category ? typeLabel(item.category) : 'Untagged'}</span>
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
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1'
  const missingCount = itemIds.length - items.length

  // A plain function, not a component, so images aren't remounted on every render.
  const piece = (item) => {
    const img = <ItemImage item={item} className="size-full" />
    return onPieceClick ? (
      <button
        key={item.id}
        type="button"
        onClick={() => onPieceClick(item)}
        className="relative min-h-0 flex-1 overflow-hidden transition-[filter] hover:brightness-110"
        title={item.name}
      >
        {img}
      </button>
    ) : (
      <div key={item.id} className="relative min-h-0 flex-1 overflow-hidden">
        {img}
      </div>
    )
  }

  return (
    <div
      className={`grid aspect-[5/4] w-full max-w-full overflow-hidden rounded-sm bg-board ${gap} ${
        shownRight.length ? 'grid-cols-[3fr_2fr]' : 'grid-cols-1'
      } ${className}`}
    >
      <div className={`flex min-h-0 flex-col ${gap}`}>
        {left.map(piece)}
        {!left.length && (
          <div className="flex flex-1 items-center justify-center bg-raised text-[13px] text-muted">{missingCount ? 'Pieces deleted' : 'Empty'}</div>
        )}
      </div>
      {shownRight.length > 0 && (
        <div className={`flex min-h-0 flex-col ${gap}`}>
          {shownRight.map((item, i) => (
            <div key={item.id} className="relative flex min-h-0 flex-1">
              {piece(item)}
              {extra > 0 && i === shownRight.length - 1 && (
                <span className="display pointer-events-none absolute inset-0 flex items-center justify-center bg-page/70 text-[28px] text-ink">+{extra}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
