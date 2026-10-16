import { useEffect, useState } from 'react'
import { relativeDays, todayKey } from '../lib/dates.js'
import { washable } from '../lib/outfits.js'
import { COLORS, FITS, FORMALITY, GROUPS, MATERIALS, PATTERNS, STYLES, TYPES, WARMTH, colorLabel, colorWord, typeLabel, typeOf } from '../lib/vocab.js'
import { ItemImage } from './Pieces.jsx'
import { Button, Chip, Field, inputClass, Notice, Segmented, Sheet, Spinner, Swatch } from './ui.jsx'

const formatPrice = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`

const PRESS = 'active:translate-x-[3px] active:translate-y-[3px] disabled:active:translate-x-0 disabled:active:translate-y-0'

/** One cell of the spec table: Courier label over a bold Courier value. */
function Row({ label, children, wide = false }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 bg-page px-3 pt-2.5 pb-3 ${wide ? 'col-span-2' : ''}`}>
      <dt className="meta text-muted">{label}</dt>
      <dd className="min-w-0 text-[15px] font-bold break-words text-ink cap-first">{children}</dd>
    </div>
  )
}

/**
 * The spec table: cells on a black board, so 4px of ink sits between every
 * cell. An odd last cell runs the full width so the table stays a hard block.
 */
function Details({ item }) {
  const fmt = FORMALITY.find((f) => f.value === item.formality)?.label
  const warm = WARMTH.find((w) => w.value === item.warmth)?.label
  const rows = [
    [
      'Type',
      <>
        {typeLabel(item.category)}
        {item.subtype ? <span className="block text-[15px] font-normal text-muted">{item.subtype}</span> : null}
      </>,
    ],
    item.colors?.length > 0 && [
      'Colours',
      <span className="flex flex-col items-start gap-1.5">
        {item.colors.map((c) => (
          <span key={c} className="inline-flex items-center gap-2">
            <Swatch color={c} size={20} /> {colorLabel(c)}
          </span>
        ))}
      </span>,
    ],
    (item.material || (item.pattern && item.pattern !== 'solid')) && ['Fabric', [item.material, item.pattern !== 'solid' ? item.pattern : null].filter(Boolean).join(', ')],
    item.fit && ['Fit', item.fit],
    fmt && ['Formality', fmt],
    warm && ['Warmth', warm],
    item.styles?.length > 0 && ['Style', item.styles.join(', ')],
    item.brand && ['Brand', item.brand],
  ].filter(Boolean)
  return (
    <dl className="grid grid-cols-[minmax(0,5fr)_minmax(0,4fr)] gap-1 border-4 border-ink bg-ink">
      {rows.map(([label, value], i) => (
        <Row key={label} label={label} wide={rows.length % 2 === 1 && i === rows.length - 1}>
          {value}
        </Row>
      ))}
      {item.notes && (
        <Row label="Notes" wide>
          {item.notes}
        </Row>
      )}
    </dl>
  )
}

function toggle(list, value, max = 99) {
  const current = list ?? []
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value].slice(-max)
}

/** A select in a 4px box with a plain ↓, since the native arrow is gone. */
function Select({ children, ...props }) {
  return (
    <span className="group relative block min-w-0">
      <select {...props} className={`${inputClass} pr-10 font-bold uppercase`}>
        {children}
      </select>
      <span aria-hidden="true" className="display pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[20px] group-hover:text-page">
        ↓
      </span>
    </span>
  )
}

function EditForm({ draft, setDraft }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  return (
    <div className="flex flex-col gap-6">
      <Field label="Name">
        {(id) => <input id={id} value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. White linen shirt" className={inputClass} maxLength={60} />}
      </Field>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-4">
        <Field label="Type">
          {(id) => (
            <Select id={id} value={draft.category ?? ''} onChange={(e) => set({ category: e.target.value || null })}>
              <option value="">Choose…</option>
              {GROUPS.map((g) => (
                <optgroup key={g.value} label={g.label}>
                  {TYPES.filter((t) => t.group === g.value).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Detail">
          {(id) => <input id={id} value={draft.subtype ?? ''} onChange={(e) => set({ subtype: e.target.value })} placeholder="e.g. oxford, cargo, chikankari" className={inputClass} maxLength={40} />}
        </Field>
      </div>
      <Field label="Colours (up to 3, main first)">
        {/* Squares joined edge to edge: each one tucks 4px under its neighbour. */}
        <div className="flex flex-wrap pt-1 pl-1">
          {COLORS.map((c) => {
            const on = draft.colors?.includes(c.value)
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                aria-label={c.label}
                title={c.label}
                onClick={() => set({ colors: toggle(draft.colors, c.value, 3) })}
                className={`group relative -mt-1 -ml-1 flex size-12 shrink-0 ${on ? 'z-10' : 'hover:z-10'} ${PRESS}`}
              >
                {/* A colour sample keeps its true colour under the hover invert, like a photo; only the mark inverts. */}
                <Swatch color={c.value} size={48} className="group-hover:invert" />
                <span aria-hidden="true" className={`absolute inset-0 items-center justify-center ${on ? 'flex' : 'hidden group-hover:flex'}`}>
                  <span className="flex size-7 items-center justify-center bg-ink text-[18px] font-bold text-page">{on ? '✓' : '+'}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Field>
      {/* Fit drops into the second column on purpose: the grid is meant to limp. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-4">
        <Field label="Pattern">
          {(id) => (
            <Select id={id} value={draft.pattern ?? ''} onChange={(e) => set({ pattern: e.target.value || null })}>
              <option value="">Not set</option>
              {PATTERNS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fabric">
          {(id) => (
            <Select id={id} value={draft.material ?? ''} onChange={(e) => set({ material: e.target.value || null })}>
              <option value="">Not set</option>
              {MATERIALS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fit" className="md:col-start-2">
          {(id) => (
            <Select id={id} value={draft.fit ?? ''} onChange={(e) => set({ fit: e.target.value || null })}>
              <option value="">Not set</option>
              {FITS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Formality">
        <Segmented label="Formality" options={FORMALITY} value={draft.formality ?? 2} onChange={(v) => set({ formality: v })} />
      </Field>
      <Field label="Warmth">
        <Segmented label="Warmth" options={WARMTH} value={draft.warmth ?? 3} onChange={(v) => set({ warmth: v })} />
      </Field>
      <Field label="Style">
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <Chip key={s} active={draft.styles?.includes(s)} onClick={() => set({ styles: toggle(draft.styles, s, 3) })}>
              {s}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] md:gap-4">
        <Field label="Brand">
          {(id) => <input id={id} value={draft.brand ?? ''} onChange={(e) => set({ brand: e.target.value })} className={inputClass} maxLength={40} />}
        </Field>
        <Field label="Price paid (₹)">
          {(id) => (
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min="0"
              value={draft.price ?? ''}
              onChange={(e) => set({ price: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
              className={`${inputClass} tnum`}
            />
          )}
        </Field>
      </div>
      <Field label="Notes for Claude" hint="e.g. “a bit tight now”, “only for weddings”, “goes with my white sneakers”">
        {(id) => <textarea id={id} rows={2} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} className={`${inputClass} block`} maxLength={160} />}
      </Field>
    </div>
  )
}

const EDITABLE = ['name', 'category', 'subtype', 'colors', 'pattern', 'material', 'fit', 'formality', 'warmth', 'styles', 'brand', 'price', 'notes']

export default function ItemSheet({ item, open, onClose, actions, uploader, canTag, onStyle, onDeleted, showToast }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)

  // A new piece without tags opens straight into editing when Claude can't tag it.
  useEffect(() => {
    if (!open || !item) return
    setEditing(!item.category && item.aiStatus !== 'pending')
    setDraft(Object.fromEntries(EDITABLE.map((k) => [k, item[k] ?? null])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  // Tags that arrive while the sheet is open fill the form too.
  useEffect(() => {
    if (open && item?.aiStatus === 'done' && !editing) setDraft(Object.fromEntries(EDITABLE.map((k) => [k, item[k] ?? null])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.aiStatus])

  if (!item) return null
  const pending = item.aiStatus === 'pending'
  const failed = item.aiStatus === 'failed'
  const cpw = item.price && item.wearCount ? item.price / item.wearCount : null

  const save = () => {
    const patch = { ...draft, formality: draft.formality ?? 2, warmth: draft.warmth ?? 3, name: (draft.name ?? '').trim(), aiStatus: item.aiStatus === 'pending' ? 'pending' : 'done' }
    if (!patch.category) return
    if (!patch.name) patch.name = `${patch.colors?.[0] ? colorWord(patch.colors[0]) + ' ' : ''}${typeLabel(patch.category).split(' / ')[0].toLowerCase()}`
    if (!patch.colors?.length) patch.colors = ['multicolor']
    actions.updateItem(item.id, patch)
    setEditing(false)
    showToast({ message: 'Saved' })
  }

  const remove = () => {
    const undo = actions.deleteItem(item)
    onClose()
    onDeleted?.(item)
    showToast({ message: `Deleted ${item.name || 'piece'}`, onUndo: undo })
  }

  // Editing: Save is the one red CTA. Viewing: Style this piece is. Each goes
  // red only once it can be pressed: a disabled red fades to pink, which is
  // off-palette, so a blocked CTA stays a plain outline until then.
  const footer = editing ? (
    <div className="flex gap-2">
      {item.category && (
        <Button variant="secondary" onClick={() => setEditing(false)} className="min-w-0 flex-[2]">
          Cancel
        </Button>
      )}
      <Button variant={draft?.category ? 'primary' : 'secondary'} onClick={save} disabled={!draft?.category} className="min-w-0 flex-[3]">
        {draft?.category ? 'Save' : 'Pick a type to save'}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      <Button variant={!item.category || pending ? 'secondary' : 'primary'} size="lg" className="w-full" onClick={() => onStyle(item)} disabled={!item.category || pending}>
        Style this piece <span aria-hidden="true">→</span>
      </Button>
      {/* Four text boxes joined edge to edge. On = black. */}
      <div className="grid grid-cols-4 border-4 border-ink">
        <QuickAction label={item.favorite ? 'Loved' : 'Love'} active={item.favorite} onClick={() => actions.updateItem(item.id, { favorite: !item.favorite })} />
        <QuickAction
          label={item.laundry ? 'In the wash' : 'Wash it'}
          active={item.laundry}
          disabled={!washable(item.category) && !item.laundry}
          onClick={() => {
            actions.setLaundry([item.id], !item.laundry)
            showToast({ message: item.laundry ? 'Back in the closet' : 'Into the wash' })
          }}
        />
        <QuickAction label="Edit" onClick={() => setEditing(true)} />
        <QuickAction label="Delete" onClick={remove} danger />
      </div>
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit piece' : item.name || (pending ? 'New piece' : 'Untitled piece')} footer={footer} wide>
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Photo and stats: one slab, the stats tucked 4px under the frame. */}
        <div className="flex min-w-0 flex-col">
          <div className="overflow-hidden border-4 border-ink bg-page [&_img]:bg-page">
            <ItemImage item={item} full fit="contain" className={`aspect-[4/5] w-full md:max-h-none ${editing ? 'max-h-[24dvh]' : 'max-h-[40dvh]'}`} />
          </div>
          {!editing && (
            <div className="-mt-1 grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] border-4 border-ink [container-type:inline-size]">
              {/* Worn is the sheet's one accent number. */}
              <Stat label="Worn" value={`${item.wearCount ?? 0}×`} big className="row-span-2 border-r-4 border-ink" />
              <Stat label="Last worn" value={relativeDays(item.lastWorn, todayKey())} className="border-b-4 border-ink" />
              {cpw || item.price ? (
                <Stat label="Per wear" value={formatPrice(cpw ?? item.price)} />
              ) : washable(item.category) ? (
                <Stat label="Till the wash" value={item.laundry ? 'Now' : `${Math.max(0, typeOf(item.category).wash - (item.wearsSinceWash ?? 0))}×`} />
              ) : (
                <Stat label="Category" value={typeLabel(item.category).split(' / ')[0]} />
              )}
            </div>
          )}
        </div>

        {/* Details sit lower than the photo on wider screens: misaligned on purpose. */}
        <div className={`flex min-w-0 flex-col gap-5 ${editing ? '' : 'md:pt-12'}`}>
          {pending && (
            <Notice tone="warn" className="flex items-center gap-3">
              <Spinner className="text-[18px]" /> Claude is tagging this piece…
            </Notice>
          )}
          {failed && (
            <Notice tone="warn" className="flex flex-col gap-3">
              <p>{item.aiError || 'Claude couldn’t tag this piece.'}</p>
              {canTag && (
                <Button size="sm" variant="secondary" className="self-start" onClick={() => uploader.retag(item)}>
                  Retry tagging
                </Button>
              )}
            </Notice>
          )}
          {!canTag && !item.category && !pending && <Notice>Tag this piece so it can go into outfits. On claude.ai, Claude does this from the photo.</Notice>}

          {editing && draft ? (
            <EditForm draft={draft} setDraft={setDraft} />
          ) : (
            item.category && (
              <>
                {item.description && <p className="text-[16px] md:mr-[12%]">{item.description}</p>}
                <Details item={item} />
                {item.laundry && <p className="text-[15px] text-muted md:ml-[20%]">In the wash, so it’s left out of outfit ideas.</p>}
                {canTag && !pending && (
                  <Button size="sm" variant="ghost" className="-ml-3 self-start bg-page" onClick={() => uploader.retag(item)}>
                    Re-tag from photo
                  </Button>
                )}
              </>
            )
          )}
        </div>
      </div>
    </Sheet>
  )
}

/** A stat box: the value in Impact, its Courier label underneath. */
function Stat({ label, value, big = false, className = '' }) {
  return (
    <div className={`flex min-w-0 flex-col justify-between gap-2 px-3 pt-3 pb-2.5 ${className}`}>
      <span className={`display break-words tnum ${big ? 'text-[clamp(44px,18cqw,112px)] text-accent' : 'text-[clamp(22px,8cqw,34px)]'}`}>{value}</span>
      <span className="meta">{label}</span>
    </div>
  )
}

/** One of the four joined quick actions: Impact words only, black when on. Delete carries a plain ×. */
function QuickAction({ label, onClick, active, danger, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`display flex min-h-14 min-w-0 flex-wrap items-center justify-center gap-x-1 px-1 py-2 text-center text-[18px] leading-[0.95]! break-words not-first:border-l-4 not-first:border-ink ${PRESS} ${
        active ? 'bg-ink text-page' : 'bg-page text-ink'
      }`}
    >
      {danger && <span aria-hidden="true">×</span>}
      <span className={disabled ? 'opacity-35' : ''}>{label}</span>
    </button>
  )
}
