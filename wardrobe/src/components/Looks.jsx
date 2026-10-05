import { Plus, Shirt, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { relativeDays, todayKey } from '../lib/dates.js'
import { canonicalOrder, dedupeBySlot, isComplete } from '../lib/outfits.js'
import { OCCASIONS, occasionLabel, typeLabel } from '../lib/vocab.js'
import { ItemTile, OutfitBoard } from './Pieces.jsx'
import { Button, Chip, Field, inputClass, Notice, Sheet } from './ui.jsx'

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
    showToast({ message: `Logged for today${toLaundry.length ? `. ${toLaundry.length} to the laundry` : ''}`, onUndo: undo })
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
            <Trash2 className="size-4" />
          </Button>
          <Button className="flex-1" onClick={wear} disabled={!pieces.length}>
            <Shirt className="size-4" /> Wear today
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <OutfitBoard itemIds={look.itemIds ?? []} itemsById={itemsById} onPieceClick={onOpenItem} />
        <div className="flex min-w-0 flex-col gap-4">
          <Field label="Name">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} className={inputClass} maxLength={60} />}</Field>
          <p className="label text-muted">
            {look.occasion ? `${occasionLabel(look.occasion)} · ` : ''}
            {look.wornCount ? `worn ${look.wornCount}× · last ${relativeDays(look.lastWorn)}` : 'not worn yet'}
            {look.source === 'claude' ? ' · styled by Claude' : ''}
          </p>
          <ul className="flex flex-col divide-y divide-line">
            {pieces.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => onOpenItem(p)} className="flex w-full items-center justify-between gap-3 py-2 text-left hover:text-accent-ink">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="label shrink-0 text-muted">{p.laundry ? 'in laundry' : typeLabel(p.category)}</span>
                </button>
              </li>
            ))}
          </ul>
          {missing > 0 && <Notice tone="warn">{missing === 1 ? 'One piece' : `${missing} pieces`} from this look were deleted from your closet.</Notice>}
          {inLaundry.length > 0 && <Notice>{inLaundry.map((p) => p.name).join(', ')} {inLaundry.length === 1 ? 'is' : 'are'} in the laundry.</Notice>}
          {look.why?.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-[14.5px] text-ink-2">
              {look.why.map((w) => (
                <li key={w} className="flex gap-2.5">
                  <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          )}
          {look.tip && (
            <p className="rounded-xl bg-raised px-3 py-2.5 text-[14px] text-ink-2">
              <span className="label mr-2 text-muted">Tip</span>
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
          <span className="label min-w-0 flex-1 text-muted">{picked.length ? `${picked.length} picked${complete ? '' : ' · add a top and bottom'}` : 'Tap pieces to add them'}</span>
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
              <Field label="Name">{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friday college fit" className={inputClass} maxLength={60} />}</Field>
              <Field label="Occasion">
                <div className="flex flex-wrap gap-1.5">
                  {OCCASIONS.map((o) => (
                    <Chip key={o.value} active={occasion === o.value} onClick={() => setOccasion(occasion === o.value ? null : o.value)} className="h-8 px-3 text-[13px]">
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="font-display text-[34px] leading-none font-semibold sm:text-[40px]">Saved looks</h1>
          <p className="label mt-2 text-muted tnum">
            {looks.length} look{looks.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setBuilding(true)} disabled={items.filter((i) => i.category).length < 2}>
          <Plus className="size-4" /> Make a look
        </Button>
      </div>

      {looks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-line bg-surface px-5 py-10 text-center">
          <h2 className="font-display text-[26px] leading-tight font-semibold">No saved looks yet</h2>
          <p className="max-w-md text-ink-2">Save the outfits Claude suggests that you love, or put one together yourself. Wear them again in one tap.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={onStyle}>
              <Sparkles className="size-4" /> Get outfit ideas
            </Button>
            <Button variant="secondary" onClick={() => setBuilding(true)} disabled={items.filter((i) => i.category).length < 2}>
              Make my own
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {looks.map((look) => (
            <button key={look.id} type="button" onClick={() => setOpenId(look.id)} className="group flex min-w-0 flex-col gap-2 text-left">
              <div className="transition-transform duration-300 group-hover:-translate-y-0.5">
                <OutfitBoard itemIds={look.itemIds ?? []} itemsById={itemsById} size="sm" />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
                <span className="truncate font-display text-[17px] leading-snug font-semibold italic">{look.name || 'Saved look'}</span>
                <span className="label truncate text-muted">
                  {look.occasion ? occasionLabel(look.occasion) : 'Any day'}
                  {look.wornCount ? ` · ${look.wornCount}×` : ''}
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
