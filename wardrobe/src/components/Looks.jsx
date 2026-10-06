import { useEffect, useMemo, useState } from 'react'
import { relativeDays, todayKey } from '../lib/dates.js'
import { canonicalOrder, dedupeBySlot, isComplete } from '../lib/outfits.js'
import { OCCASIONS, occasionLabel, typeLabel } from '../lib/vocab.js'
import { ItemTile, OutfitBoard } from './Pieces.jsx'
import { Button, Chip, Field, inputClass, Notice, PageTitle, Sheet } from './ui.jsx'

const PRESS = 'active:translate-x-[3px] active:translate-y-[3px]'

// A meta pill: a 4px box with Courier caps. Black when it says something strong.
const pill = (strong = false) => `meta border-4 border-ink px-2 py-1 ${strong ? 'bg-ink text-page' : 'bg-page text-ink'}`

// Deliberate misalignment: every second tile in a row drops. Phones (2 cols)
// drop the right tile, md (3 cols) the middle one, lg (4 cols) the 2nd and 4th.
const stagger = (i) => `min-w-0 ${i % 2 ? 'mt-8 lg:mt-12' : 'mt-0 lg:mt-0'} ${i % 3 === 1 ? 'md:mt-12' : 'md:mt-0'}`

function LookSheet({ look, open, onClose, itemsById, actions, showToast, onOpenItem }) {
  const [name, setName] = useState('')
  useEffect(() => {
    if (open && look) setName(look.name ?? '')
  }, [open, look])
  if (!look) return null
  const pieces = (look.itemIds ?? []).map((id) => itemsById[id]).filter(Boolean)
  const missing = (look.itemIds ?? []).length - pieces.length
  const inLaundry = pieces.filter((p) => p.laundry)

  const wear = () => {
    const { undo, toLaundry } = actions.logWear({ date: todayKey(), itemIds: pieces.map((p) => p.id), title: look.name, lookId: look.id, occasion: look.occasion })
    showToast({ message: `Logged for today${toLaundry.length ? `. ${toLaundry.length} into the wash` : ''}`, onUndo: undo })
    onClose()
  }
  const remove = () => {
    const undo = actions.deleteLook(look)
    showToast({ message: `Deleted “${look.name}”`, onUndo: undo })
    onClose()
  }
  const rename = () => {
    const next = name.trim()
    if (next && next !== look.name) actions.updateLook(look.id, { name: next })
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        rename()
        onClose()
      }}
      title={look.name || 'Saved look'}
      wide
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={remove} aria-label="Delete look">
            <span aria-hidden="true">×</span> Delete
          </Button>
          {/* The sheet's one accent CTA, an outline until it can be pressed (a faded accent reads pink). */}
          <Button variant={pieces.length ? 'primary' : 'secondary'} className="flex-1" onClick={wear} disabled={!pieces.length}>
            Wear today
          </Button>
        </div>
      }
    >
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <OutfitBoard itemIds={look.itemIds ?? []} itemsById={itemsById} onPieceClick={onOpenItem} />
        <div className="flex min-w-0 flex-col gap-5 md:pt-10">
          <Field label="Name">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} className={inputClass} maxLength={60} />}</Field>
          <div className="flex flex-wrap gap-2">
            {look.occasion && <span className={pill()}>{occasionLabel(look.occasion)}</span>}
            <span className={pill()}>{look.wornCount ? `Worn ${look.wornCount}×, last ${relativeDays(look.lastWorn)}` : 'Not worn yet'}</span>
            {look.source === 'claude' && <span className={pill(true)}>Styled by Claude</span>}
          </div>
          <ul className="flex flex-col border-4 border-ink">
            {pieces.map((p) => (
              <li key={p.id} className="not-first:border-t-4 not-first:border-ink">
                <button type="button" onClick={() => onOpenItem(p)} className={`flex w-full items-center justify-between gap-3 bg-page px-3 py-2.5 text-left text-ink ${PRESS}`}>
                  <span className="min-w-0 truncate text-[15px] font-bold">{p.name}</span>
                  <span className="meta shrink-0">{p.laundry ? 'In the wash' : typeLabel(p.category)}</span>
                </button>
              </li>
            ))}
          </ul>
          {missing > 0 && <Notice tone="warn">{missing === 1 ? 'One piece' : `${missing} pieces`} from this look were deleted from your closet.</Notice>}
          {inLaundry.length > 0 && <Notice>{inLaundry.map((p) => p.name).join(', ')} {inLaundry.length === 1 ? 'is' : 'are'} in the wash.</Notice>}
          {look.why?.length > 0 && (
            <div className="flex flex-col gap-2 border-l-4 border-ink pl-4 text-[15px]">
              {look.why.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
          {look.tip && (
            <p className="text-[15px]">
              <span className="display mr-2 text-[22px]">Styling tip:</span>
              {look.tip}
            </p>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function LookBuilder({ open, onClose, items, itemsById, actions, showToast }) {
  const [picked, setPicked] = useState([])
  const [name, setName] = useState('')
  const [occasion, setOccasion] = useState(null)
  useEffect(() => {
    if (open) {
      setPicked([])
      setName('')
      setOccasion(null)
    }
  }, [open])

  const choices = items.filter((i) => i.category)
  const toggle = (item) => {
    setPicked((ids) => {
      if (ids.includes(item.id)) return ids.filter((x) => x !== item.id)
      // Picking a second shirt swaps out the first, and a dress replaces separates.
      return dedupeBySlot([item.id, ...ids], itemsById, [item.id])
    })
  }
  const ordered = canonicalOrder(picked, itemsById)
  const complete = isComplete(picked, itemsById)

  const save = () => {
    actions.saveLook({ name: name.trim() || 'My look', itemIds: ordered, occasion, source: 'me' })
    showToast({ message: 'Look saved' })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Make a look"
      wide
      footer={
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 text-[15px]">
            {picked.length ? (
              <>
                <span className="font-bold tnum">{picked.length} picked</span>
                {complete ? '' : '. Add a top and a bottom.'}
              </>
            ) : (
              'Tap pieces to add them.'
            )}
          </span>
          {/* The builder's one accent CTA, an outline until two pieces are picked (a faded accent reads pink). */}
          <Button variant={picked.length < 2 ? 'secondary' : 'primary'} onClick={save} disabled={picked.length < 2}>
            Save look
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {picked.length > 0 && (
          <div className="grid items-start gap-5 border-b-4 border-ink pb-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <OutfitBoard itemIds={ordered} itemsById={itemsById} />
            <div className="flex min-w-0 flex-col gap-5 md:pt-8">
              <Field label="Name">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday college fit" className={inputClass} maxLength={60} />}</Field>
              <Field label="Occasion">
                <div className="flex flex-wrap gap-2">
                  {OCCASIONS.map((o) => (
                    <Chip key={o.value} active={occasion === o.value} onClick={() => setOccasion(occasion === o.value ? null : o.value)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 items-start gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5">
          {choices.map((item) => (
            <ItemTile key={item.id} item={item} selectable selected={picked.includes(item.id)} onOpen={toggle} />
          ))}
        </div>
        {!choices.length && (
          <div className="flex flex-col gap-2 border-4 border-ink px-4 py-6">
            <p className="display text-[32px]">Nothing to pick yet</p>
            <p className="text-[16px]">Add and tag some pieces first.</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}

export default function Looks({ looks, items, itemsById, actions, showToast, onOpenItem, onStyle }) {
  const [openId, setOpenId] = useState(null)
  const [building, setBuilding] = useState(false)
  const open = useMemo(() => looks.find((l) => l.id === openId) ?? null, [looks, openId])

  const canBuild = items.filter((i) => i.category).length >= 2

  return (
    <div className="flex flex-col gap-10">
      {/* Hero: the look count is the section's one accent number. Make a look is an outline, lg like Add photos on Closet. */}
      <PageTitle
        count={looks.length || null}
        sub={looks.length > 0 ? 'Fits you kept. Wear any of them again in one tap.' : null}
        aside={
          looks.length > 0 && (
            <Button variant="secondary" size="lg" onClick={() => setBuilding(true)} disabled={!canBuild}>
              Make a look
            </Button>
          )
        }
      >
        Saved looks
      </PageTitle>

      {looks.length === 0 ? (
        <div className="slam flex flex-col gap-8">
          <h2 className="display min-w-0 text-[clamp(64px,13vw,150px)] break-words">No looks saved yet</h2>
          <div className="flex flex-col items-start gap-5 md:ml-[38%]">
            <p className="max-w-[46ch] text-[16px]">Save the fits you love from Style me, or put one together yourself. Then wear them again in one tap.</p>
            <div className="flex flex-wrap gap-2">
              {/* The screen's one accent CTA. */}
              <Button variant="primary" size="lg" onClick={onStyle}>
                Build my fit <span aria-hidden="true">→</span>
              </Button>
              <Button variant="secondary" size="lg" onClick={() => setBuilding(true)} disabled={!canBuild}>
                Make my own
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ol className="grid grid-cols-2 items-start gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-4 lg:grid-cols-4">
          {looks.map((look, i) => (
            <li key={look.id} className={`slam ${stagger(i)}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <button type="button" onClick={() => setOpenId(look.id)} className={`flex w-full min-w-0 flex-col bg-page text-left text-ink ${PRESS}`}>
                {/* Numbered like a work index: 01, 02, 03. Black, never accent. */}
                <span className="flex items-end justify-between gap-2 border-4 border-b-0 border-ink px-2 pt-2 pb-1.5">
                  <span className="display text-[44px] tnum sm:text-[56px]">{String(i + 1).padStart(2, '0')}</span>
                  {look.source === 'claude' && <span className="meta pb-1">Claude</span>}
                </span>
                <OutfitBoard itemIds={look.itemIds ?? []} itemsById={itemsById} />
                <span className="flex min-w-0 flex-col gap-1.5 border-4 border-t-0 border-ink px-2 pt-2 pb-3">
                  {/* 0.95 (important: .display is unlayered) so a clamped third line can't peek out below. */}
                  <span className="display line-clamp-2 text-[22px] leading-[0.95]! break-words sm:text-[28px]">{look.name || 'Saved look'}</span>
                  <span className="meta truncate">
                    {look.occasion ? occasionLabel(look.occasion) : 'Any day'}
                    {look.wornCount ? ` / worn ${look.wornCount}×` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <LookSheet look={open} open={Boolean(open)} onClose={() => setOpenId(null)} itemsById={itemsById} actions={actions} showToast={showToast} onOpenItem={onOpenItem} />
      <LookBuilder open={building} onClose={() => setBuilding(false)} items={items} itemsById={itemsById} actions={actions} showToast={showToast} />
    </div>
  )
}
