import { ArrowRight, Plus, Trash, TShirt } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { relativeDays, todayKey } from '../lib/dates.js'
import { canonicalOrder, dedupeBySlot, isComplete } from '../lib/outfits.js'
import { OCCASIONS, occasionLabel, typeLabel } from '../lib/vocab.js'
import { ItemTile, OutfitBoard } from './Pieces.jsx'
import { Button, Chip, Field, inputClass, Notice, PageTitle, Sheet } from './ui.jsx'

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
          <Button variant="danger" onClick={remove} aria-label="Delete look">
            <Trash weight="bold" className="size-4" />
          </Button>
          <Button className="flex-1" onClick={wear} disabled={!pieces.length}>
            <TShirt weight="bold" className="size-4" /> Wear today
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <OutfitBoard itemIds={look.itemIds ?? []} itemsById={itemsById} onPieceClick={onOpenItem} />
        <div className="flex min-w-0 flex-col gap-4">
          <Field label="Name">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} className={inputClass} maxLength={60} />}</Field>
          <div className="flex flex-wrap gap-1.5">
            {look.occasion && <span className="meta rounded-sm bg-raised px-2 py-1 text-ink-2">{occasionLabel(look.occasion)}</span>}
            <span className="meta rounded-sm bg-raised px-2 py-1 text-ink-2">{look.wornCount ? `Worn ${look.wornCount}×, last ${relativeDays(look.lastWorn)}` : 'Not worn yet'}</span>
            {look.source === 'claude' && <span className="meta rounded-sm bg-raised px-2 py-1 text-ink-2">Styled by Claude</span>}
          </div>
          <ul className="flex flex-col gap-1">
            {pieces.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpenItem(p)} className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-raised">
                  <span className="min-w-0 truncate font-semibold">{p.name}</span>
                  <span className="meta shrink-0 text-muted">{p.laundry ? 'In the wash' : typeLabel(p.category)}</span>
                </button>
              </li>
            ))}
          </ul>
          {missing > 0 && <Notice tone="warn">{missing === 1 ? 'One piece' : `${missing} pieces`} from this look were deleted from your closet.</Notice>}
          {inLaundry.length > 0 && <Notice>{inLaundry.map((p) => p.name).join(', ')} {inLaundry.length === 1 ? 'is' : 'are'} in the wash.</Notice>}
          {look.why?.length > 0 && (
            <div className="flex flex-col gap-2 border-l-[3px] border-accent pl-3.5 text-[15px]">
              {look.why.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
          {look.tip && (
            <p className="text-[14px] text-ink-2">
              <span className="condensed mr-2 text-[13px] text-ink">Styling tip</span>
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
          <span className="min-w-0 flex-1 text-[14px] text-muted">{picked.length ? `${picked.length} picked${complete ? '' : '. Add a top and a bottom.'}` : 'Tap pieces to add them.'}</span>
          <Button onClick={save} disabled={picked.length < 2}>
            Save look
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {picked.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <OutfitBoard itemIds={ordered} itemsById={itemsById} size="sm" />
            <div className="flex flex-col gap-4">
              <Field label="Name">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday college fit" className={inputClass} maxLength={60} />}</Field>
              <Field label="Occasion">
                <div className="flex flex-wrap gap-1.5">
                  {OCCASIONS.map((o) => (
                    <Chip key={o.value} active={occasion === o.value} onClick={() => setOccasion(occasion === o.value ? null : o.value)} className="h-8 text-[13px]">
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4 lg:grid-cols-5">
          {choices.map((item) => (
            <ItemTile key={item.id} item={item} selectable selected={picked.includes(item.id)} onOpen={toggle} />
          ))}
        </div>
        {!choices.length && <p className="py-6 text-center text-muted">Add and tag some pieces first.</p>}
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
    <div className="flex flex-col gap-8">
      <PageTitle
        count={looks.length || null}
        aside={
          looks.length > 0 && (
            <Button variant="secondary" onClick={() => setBuilding(true)} disabled={!canBuild}>
              <Plus weight="bold" className="size-4" /> Make a look
            </Button>
          )
        }
      >
        Saved looks
      </PageTitle>

      {looks.length === 0 ? (
        <div className="rise flex flex-col items-start gap-5 rounded-sm bg-surface p-5 sm:p-8">
          <h2 className="display text-[48px] sm:text-[64px]">No looks saved yet</h2>
          <p className="max-w-[48ch] text-[16px] text-ink-2">Save the fits you love from Style me, or put one together yourself. Then wear them again in one tap.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={onStyle}>
              Build my fit <ArrowRight weight="bold" className="size-5" />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setBuilding(true)} disabled={!canBuild}>
              Make my own
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {looks.map((look, i) => (
            <button
              key={look.id}
              type="button"
              onClick={() => setOpenId(look.id)}
              className="group rise flex min-w-0 flex-col gap-2.5 text-left"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <div className="transition-transform duration-300 group-hover:-translate-y-1">
                <OutfitBoard itemIds={look.itemIds ?? []} itemsById={itemsById} size="sm" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="display line-clamp-2 pb-0.5 text-[24px]">{look.name || 'Saved look'}</span>
                <span className="meta truncate text-muted">
                  {look.occasion ? occasionLabel(look.occasion) : 'Any day'}
                  {look.wornCount ? `, worn ${look.wornCount}×` : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <LookSheet look={open} open={Boolean(open)} onClose={() => setOpenId(null)} itemsById={itemsById} actions={actions} showToast={showToast} onOpenItem={onOpenItem} />
      <LookBuilder open={building} onClose={() => setBuilding(false)} items={items} itemsById={itemsById} actions={actions} showToast={showToast} />
    </div>
  )
}
