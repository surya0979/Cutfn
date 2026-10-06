import { useState } from 'react'
import { usePhotoUrl } from '../lib/store.js'
import { colorLabel, roleOf, typeLabel } from '../lib/vocab.js'
import GarmentType from './GarmentType.jsx'
import { Spinner } from './ui.jsx'

/** A piece's photo (thumbnail by default), or its type on its colour when there's none. */
export function ItemImage({ item, full = false, className = '', fit = 'cover' }) {
  const fullUrl = usePhotoUrl(full ? item : null)
  const src = full ? fullUrl : item?.thumb
  const [failed, setFailed] = useState(null)
  if (!item) return <div className={`bg-raised ${className}`} />
  if (!src || failed === src) return <GarmentType category={item.category} color={item.colors?.[0]} className={className} />
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

/**
 * One tile in the closet: a 4px frame, the photo, then the name in Impact and
 * the type and colours in Courier. The black swing tag counts wears.
 */
export function ItemTile({ item, onOpen, selected, selectable = false }) {
  const pending = item.aiStatus === 'pending'
  const failed = item.aiStatus === 'failed'
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      className={`flex w-full min-w-0 flex-col border-4 text-left active:translate-x-[3px] active:translate-y-[3px] ${
        selected ? 'border-ink bg-ink text-page' : 'border-ink bg-page text-ink'
      }`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden border-b-4 border-ink">
        <ItemImage item={item} className="size-full" />
        {pending && (
          <span className="meta absolute inset-x-0 bottom-0 flex items-center gap-2 border-t-4 border-ink bg-page px-2 py-1.5 text-ink">
            <Spinner /> Claude is tagging
          </span>
        )}
        {failed && <span className="meta absolute inset-x-0 bottom-0 border-t-4 border-ink bg-ink px-2 py-1.5 text-page">Needs tags</span>}
        {!pending && item.wearCount > 0 && (
          <span className="hangtag absolute top-2 left-0 tnum" title={`Worn ${item.wearCount} times`}>
            {item.wearCount}×
          </span>
        )}
        <span className="absolute top-0 right-0 flex">
          {item.laundry && <span className="meta border-b-4 border-l-4 border-ink bg-page px-1.5 py-1 text-ink">In the wash</span>}
          {item.favorite && <span className="meta border-b-4 border-l-4 border-ink bg-ink px-1.5 py-1 text-page">Fav</span>}
        </span>
        {selected && <span className="display absolute right-0 bottom-0 border-t-4 border-l-4 border-ink bg-ink px-2 py-1 text-[22px] text-page">✓</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-1 px-2 pt-2 pb-2.5">
        <span className="display line-clamp-2 text-[22px] break-words">{pending ? 'New piece' : item.name || typeLabel(item.category)}</span>
        <span className="meta truncate opacity-80">
          {item.category ? typeLabel(item.category) : 'Untagged'}
          {item.colors?.length ? ` / ${item.colors.slice(0, 2).map(colorLabel).join(' + ')}` : ''}
        </span>
      </div>
    </button>
  )
}

const MAIN_ROLES = new Set(['full_body', 'suit', 'base_top', 'bottom'])

/**
 * An outfit as a flat-lay on a black board: body pieces large on the left,
 * layers, shoes and accessories stacked on the right, 4px of black between.
 */
export function OutfitBoard({ itemIds, itemsById, onPieceClick, className = '' }) {
  const items = itemIds.map((id) => itemsById[id]).filter(Boolean)
  const main = items.filter((i) => MAIN_ROLES.has(roleOf(i.category)))
  const side = items.filter((i) => !MAIN_ROLES.has(roleOf(i.category)))
  const left = main.length ? main : side.slice(0, 2)
  const right = main.length ? side : side.slice(2)
  const shownRight = right.slice(0, 4)
  const extra = right.length - shownRight.length
  const missingCount = itemIds.length - items.length

  // A plain function, not a component, so images aren't remounted on every render.
  const piece = (item) => {
    const img = <ItemImage item={item} className="size-full" />
    return onPieceClick ? (
      <button key={item.id} type="button" onClick={() => onPieceClick(item)} className="relative min-h-0 flex-1 overflow-hidden bg-page" title={item.name}>
        {img}
      </button>
    ) : (
      <div key={item.id} className="relative min-h-0 flex-1 overflow-hidden bg-page">
        {img}
      </div>
    )
  }

  return (
    <div
      className={`grid aspect-[5/4] w-full max-w-full gap-1 overflow-hidden border-4 border-ink bg-board ${shownRight.length ? 'grid-cols-[3fr_2fr]' : 'grid-cols-1'} ${className}`}
    >
      <div className="flex min-h-0 flex-col gap-1">
        {left.map(piece)}
        {!left.length && <div className="meta flex flex-1 items-center justify-center bg-raised text-ink">{missingCount ? 'Pieces deleted' : 'Empty'}</div>}
      </div>
      {shownRight.length > 0 && (
        <div className="flex min-h-0 flex-col gap-1">
          {shownRight.map((item, i) => (
            <div key={item.id} className="relative flex min-h-0 flex-1">
              {piece(item)}
              {extra > 0 && i === shownRight.length - 1 && (
                <span className="display pointer-events-none absolute inset-0 flex items-center justify-center bg-ink text-[32px] text-page">+{extra}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
