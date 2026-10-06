import { useState } from 'react'
import { OutfitBoard } from './Pieces.jsx'
import { Button, Chip, Notice } from './ui.jsx'

const DISLIKE_REASONS = ['Not my style', 'Colours clash', 'Wrong for the weather', 'Too formal', 'Too casual', 'Wore it too much']

const PRESS = 'active:translate-x-[3px] active:translate-y-[3px]'

/**
 * One suggested outfit as a lookbook page in a hard frame: the flat-lay on its
 * black board, the look number in giant red Impact (Claude ranks them,
 * strongest first: this is the card's one red number), the reasoning, actions.
 * outfit = { itemIds, title, why[], tip, missing, complete }
 */
export default function OutfitCard({ outfit, itemsById, index, featured = false, onWear, onSave, onFeedback, onOpenItem, worn, saved, feedback }) {
  const [asking, setAsking] = useState(false)
  const pieces = outfit.itemIds.map((id) => itemsById[id]).filter(Boolean)
  const square = (on) => `display flex size-12 shrink-0 items-center justify-center border-4 border-ink text-[26px] ${PRESS} ${on ? 'bg-ink text-page' : 'bg-page text-ink'}`

  return (
    <article
      className={`slam grid min-w-0 ${featured ? 'md:col-span-2 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]' : ''}`}
      style={{ animationDelay: `${Math.min(index, 3) * 70}ms` }}
    >
      {/* The board keeps its own frame; black fills below it when the text runs taller. */}
      <div className="min-w-0 bg-board">
        <OutfitBoard itemIds={outfit.itemIds} itemsById={itemsById} onPieceClick={onOpenItem} />
      </div>

      <div
        className={`flex min-w-0 flex-col gap-5 border-4 border-t-0 border-ink bg-page p-4 sm:p-5 ${featured ? 'md:border-t-4 md:border-l-0 md:p-7' : ''}`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`display shrink-0 leading-[0.8] text-accent tnum ${featured ? 'text-[80px] md:text-[128px]' : 'text-[80px]'}`}
            aria-label={`Look ${index + 1}`}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className={`display min-w-0 pt-3 break-words ${featured ? 'text-[32px] md:pt-6 md:text-[52px]' : 'text-[30px]'}`}>{outfit.title}</h3>
        </div>

        <p className="text-[15px] leading-[2]">
          {pieces.map((p, i) => (
            <span key={p.id}>
              <button type="button" onClick={() => onOpenItem(p)} className="text-left font-bold text-ink underline decoration-4 underline-offset-4">
                {p.name}
              </button>
              {i < pieces.length - 1 && <span className="font-bold"> + </span>}
            </span>
          ))}
        </p>

        {outfit.why.length > 0 && (
          <div className={`flex flex-col gap-2 border-l-4 border-ink pl-4 ${featured ? 'text-[15px] md:ml-8 md:text-[16px]' : 'text-[15px]'}`}>
            {outfit.why.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}
        {outfit.tip && (
          <p className="text-[15px]">
            <span className="display mr-2 text-[22px]">Styling tip:</span>
            {outfit.tip}
          </p>
        )}
        {outfit.missing && (
          <p className="text-[15px]">
            <span className="font-bold uppercase">Would finish it:</span> {outfit.missing}
          </p>
        )}
        {!outfit.complete && <Notice tone="warn">Missing a top or bottom from your closet.</Notice>}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t-4 border-ink pt-4">
          <Button variant="black" onClick={onWear} disabled={worn}>
            {worn ? 'Wearing it' : 'Wear today'}
          </Button>
          <Button variant="secondary" onClick={onSave} disabled={saved}>
            {saved ? 'Saved' : 'Save'}
          </Button>
          <span className="ml-auto flex gap-2">
            <button type="button" aria-label="More like this" title="More like this" aria-pressed={feedback === 'liked'} onClick={() => onFeedback('liked')} className={square(feedback === 'liked')}>
              ↑
            </button>
            <button
              type="button"
              aria-label="Not for me"
              title="Not for me"
              aria-pressed={feedback === 'disliked'}
              onClick={() => setAsking((a) => !a)}
              className={square(feedback === 'disliked')}
            >
              ↓
            </button>
          </span>
        </div>

        {asking && (
          <div className="slam flex flex-col gap-3 border-4 border-ink p-3">
            <p className="text-[15px]">
              <span className="display mr-2 text-[22px]">What’s off?</span>
              Claude will remember.
            </p>
            <div className="flex flex-wrap gap-2">
              {DISLIKE_REASONS.map((r) => (
                <Chip
                  key={r}
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
