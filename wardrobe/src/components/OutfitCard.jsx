import { BookmarkSimple, Check, ShoppingBag, ThumbsDown, ThumbsUp, TShirt } from '@phosphor-icons/react'
import { useState } from 'react'
import { OutfitBoard } from './Pieces.jsx'
import { Button, Chip } from './ui.jsx'

const DISLIKE_REASONS = ['Not my style', 'Colours clash', 'Wrong for the weather', 'Too formal', 'Too casual', 'Wore it too much']

/**
 * One suggested outfit, laid out like a lookbook page: the flat-lay, a big
 * look number (Claude ranks them, strongest first), the reasoning, and actions.
 * outfit = { itemIds, title, why[], tip, missing, complete }
 */
export default function OutfitCard({ outfit, itemsById, index, featured = false, onWear, onSave, onFeedback, onOpenItem, worn, saved, feedback }) {
  const [asking, setAsking] = useState(false)
  const pieces = outfit.itemIds.map((id) => itemsById[id]).filter(Boolean)

  return (
    <article
      className={`drop-in grid gap-5 rounded-sm bg-surface p-3 sm:p-4 ${featured ? 'md:col-span-2 md:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] md:gap-8 md:p-5' : ''}`}
      style={{ animationDelay: `${Math.min(index, 3) * 70}ms` }}
    >
      <OutfitBoard itemIds={outfit.itemIds} itemsById={itemsById} onPieceClick={onOpenItem} />

      <div className="flex min-w-0 flex-col gap-4 px-1 pb-1">
        <div className="flex items-start gap-3">
          <span className="display shrink-0 pb-1 text-[56px] text-accent-ink tnum" aria-label={`Look ${index + 1}`}>
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className={`display min-w-0 pt-1.5 pb-1 ${featured ? 'text-[34px] md:text-[48px]' : 'text-[30px]'}`}>{outfit.title}</h3>
        </div>

        <p className="text-[14px] text-ink-2">
          {pieces.map((p, i) => (
            <span key={p.id}>
              <button type="button" onClick={() => onOpenItem(p)} className="font-semibold text-ink underline decoration-line decoration-[1.5px] underline-offset-4 hover:decoration-accent">
                {p.name}
              </button>
              {i < pieces.length - 1 && <span className="px-1.5 text-muted">+</span>}
            </span>
          ))}
        </p>

        {outfit.why.length > 0 && (
          <div className={`flex flex-col gap-2 border-l-[3px] border-accent pl-3.5 ${featured ? 'text-[15px] md:text-[17px]' : 'text-[15px]'}`}>
            {outfit.why.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}
        {outfit.tip && (
          <p className="text-[14px] text-ink-2">
            <span className="condensed mr-2 text-[13px] text-ink">Styling tip</span>
            {outfit.tip}
          </p>
        )}
        {outfit.missing && (
          <p className="flex items-start gap-2 text-[14px] text-muted">
            <ShoppingBag weight="bold" className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Would finish it: <span className="font-semibold text-ink-2">{outfit.missing}</span>
            </span>
          </p>
        )}
        {!outfit.complete && <p className="text-[14px] text-warn">Missing a top or bottom from your closet.</p>}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={onWear} disabled={worn}>
            {worn ? <Check weight="bold" className="size-4" /> : <TShirt weight="bold" className="size-4" />} {worn ? 'Wearing it' : 'Wear today'}
          </Button>
          <Button variant="secondary" onClick={onSave} disabled={saved}>
            <BookmarkSimple weight={saved ? 'fill' : 'bold'} className="size-4" /> {saved ? 'Saved' : 'Save'}
          </Button>
          <span className="ml-auto flex gap-1">
            <button
              type="button"
              aria-label="More like this"
              aria-pressed={feedback === 'liked'}
              onClick={() => onFeedback('liked')}
              className={`flex size-11 items-center justify-center rounded-sm transition-colors ${feedback === 'liked' ? 'bg-good/15 text-good' : 'text-muted hover:bg-raised hover:text-ink'}`}
            >
              <ThumbsUp weight={feedback === 'liked' ? 'fill' : 'bold'} className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Not for me"
              aria-pressed={feedback === 'disliked'}
              onClick={() => setAsking((a) => !a)}
              className={`flex size-11 items-center justify-center rounded-sm transition-colors ${feedback === 'disliked' ? 'bg-critical/15 text-critical' : 'text-muted hover:bg-raised hover:text-ink'}`}
            >
              <ThumbsDown weight={feedback === 'disliked' ? 'fill' : 'bold'} className="size-5" />
            </button>
          </span>
        </div>

        {asking && (
          <div className="rise flex flex-col gap-2.5 rounded-sm bg-raised p-3">
            <p className="text-[14px] font-semibold">What’s off? Claude will remember.</p>
            <div className="flex flex-wrap gap-1.5">
              {DISLIKE_REASONS.map((r) => (
                <Chip
                  key={r}
                  className="h-8 text-[13px]"
                  onClick={() => {
                    onFeedback('disliked', r)
                    setAsking(false)
                  }}
                >
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
