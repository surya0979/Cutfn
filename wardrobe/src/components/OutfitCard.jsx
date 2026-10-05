import { Bookmark, BookmarkCheck, Check, Shirt, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { OutfitBoard } from './Pieces.jsx'
import { Button, Chip } from './ui.jsx'

const DISLIKE_REASONS = ['Not my style', 'Colours clash', 'Wrong for the weather', 'Too formal', 'Too casual', 'Worn it too much']

/**
 * One suggested outfit: the flat-lay, Claude's reasoning, and what to do with it.
 * outfit = { itemIds, title, why[], tip, missing, complete }
 */
export default function OutfitCard({ outfit, itemsById, index, onWear, onSave, onFeedback, onOpenItem, worn, saved, feedback }) {
  const [asking, setAsking] = useState(false)
  const pieces = outfit.itemIds.map((id) => itemsById[id]).filter(Boolean)

  return (
    <article className="rise flex flex-col gap-4 rounded-3xl bg-surface p-3 shadow-card sm:p-4" style={{ animationDelay: `${index * 60}ms` }}>
      <OutfitBoard itemIds={outfit.itemIds} itemsById={itemsById} onPieceClick={onOpenItem} />

      <div className="flex flex-col gap-3 px-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[24px] leading-tight font-semibold italic">{outfit.title}</h3>
          <span className="label shrink-0 text-muted">Look {index + 1}</span>
        </div>

        <ul className="flex flex-wrap gap-x-2 gap-y-1 text-[13.5px] text-ink-2">
          {pieces.map((p, i) => (
            <li key={p.id} className="inline-flex items-center gap-2">
              <button type="button" onClick={() => onOpenItem(p)} className="underline decoration-line underline-offset-4 hover:decoration-ink">
                {p.name}
              </button>
              {i < pieces.length - 1 && <span className="text-muted">+</span>}
            </li>
          ))}
        </ul>

        {outfit.why.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-[14.5px]">
            {outfit.why.map((w) => (
              <li key={w} className="flex gap-2.5">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        )}
        {outfit.tip && (
          <p className="rounded-xl bg-raised px-3 py-2.5 text-[14px] text-ink-2">
            <span className="label mr-2 text-muted">Tip</span>
            {outfit.tip}
          </p>
        )}
        {outfit.missing && (
          <p className="text-[13.5px] text-muted">
            <span className="label mr-2">Would finish it</span>
            {outfit.missing}
          </p>
        )}
        {!outfit.complete && <p className="text-[13.5px] text-warn">This one is missing a top or bottom from your closet.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
        <Button size="sm" onClick={onWear} disabled={worn}>
          {worn ? <Check className="size-4" /> : <Shirt className="size-4" />} {worn ? 'Wearing today' : 'Wear today'}
        </Button>
        <Button size="sm" variant="secondary" onClick={onSave} disabled={saved}>
          {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />} {saved ? 'Saved' : 'Save look'}
        </Button>
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            aria-label="More like this"
            aria-pressed={feedback === 'liked'}
            onClick={() => onFeedback('liked')}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${feedback === 'liked' ? 'bg-good/15 text-good' : 'text-muted hover:bg-raised hover:text-ink'}`}
          >
            <ThumbsUp className="size-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Not for me"
            aria-pressed={feedback === 'disliked'}
            onClick={() => setAsking((a) => !a)}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${feedback === 'disliked' ? 'bg-critical/12 text-critical' : 'text-muted hover:bg-raised hover:text-ink'}`}
          >
            <ThumbsDown className="size-[18px]" />
          </button>
        </span>
      </div>

      {asking && (
        <div className="flex flex-col gap-2 rounded-2xl bg-raised p-3">
          <p className="text-[13.5px] text-ink-2">What’s off? Claude will remember it next time.</p>
          <div className="flex flex-wrap gap-1.5">
            {DISLIKE_REASONS.map((r) => (
              <Chip
                key={r}
                className="h-8 px-3 text-[13px]"
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
    </article>
  )
}
