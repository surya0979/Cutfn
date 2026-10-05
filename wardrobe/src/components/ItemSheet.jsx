import { Heart, Pencil, RefreshCw, Sparkles, Trash2, WashingMachine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { relativeDays, todayKey } from '../lib/dates.js'
import { washable } from '../lib/outfits.js'
import { COLORS, FITS, FORMALITY, GROUPS, MATERIALS, PATTERNS, STYLES, TYPES, WARMTH, colorLabel, colorWord, typeLabel } from '../lib/vocab.js'
import { ItemImage } from './Pieces.jsx'
import { Button, Chip, Field, inputClass, Notice, Segmented, Sheet, Spinner, Swatch } from './ui.jsx'

const formatPrice = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`

function Row({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="label shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[15px] text-ink">{children}</dd>
    </div>
  )
}

function Details({ item }) {
  const fmt = FORMALITY.find((f) => f.value === item.formality)?.label
  const warm = WARMTH.find((w) => w.value === item.warmth)?.label
  return (
    <dl className="flex flex-col">
      <Row label="Type">
        {typeLabel(item.category)}
        {item.subtype ? <span className="text-muted"> · {item.subtype}</span> : null}
      </Row>
      {item.colors?.length > 0 && (
        <Row label="Colours">
          <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {item.colors.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <Swatch color={c} size={13} /> {colorLabel(c)}
              </span>
            ))}
          </span>
        </Row>
      )}
      {(item.material || (item.pattern && item.pattern !== 'solid')) && (
        <Row label="Fabric">{[item.material, item.pattern !== 'solid' ? item.pattern : null].filter(Boolean).join(' · ')}</Row>
      )}
      {item.fit && <Row label="Fit">{item.fit}</Row>}
      {fmt && <Row label="Formality">{fmt}</Row>}
      {warm && <Row label="Warmth">{warm}</Row>}
      {item.styles?.length > 0 && <Row label="Style">{item.styles.join(', ')}</Row>}
      {item.brand && <Row label="Brand">{item.brand}</Row>}
      {item.notes && <Row label="Notes">{item.notes}</Row>}
    </dl>
  )
}

function toggle(list = [], value, max = 99) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value].slice(-max)
}

function EditForm({ draft, setDraft }) {
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  return (
    <div className="flex flex-col gap-4">
      <Field label="Name">
        {(id) => <input id={id} value={draft.name ?? ''} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. White linen shirt" className={inputClass} maxLength={60} />}
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          {(id) => (
            <select id={id} value={draft.category ?? ''} onChange={(e) => set({ category: e.target.value || null })} className={inputClass}>
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
            </select>
          )}
        </Field>
        <Field label="Detail">
          {(id) => <input id={id} value={draft.subtype ?? ''} onChange={(e) => set({ subtype: e.target.value })} placeholder="e.g. oxford, cargo, chikankari" className={inputClass} maxLength={40} />}
        </Field>
      </div>
      <Field label="Colours (up to 3, main first)">
        <div className="flex flex-wrap gap-1.5">
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
                className={`flex size-9 items-center justify-center rounded-full border-2 transition-colors ${on ? 'border-ink' : 'border-transparent hover:border-line'}`}
              >
                <Swatch color={c.value} size={24} />
              </button>
            )
          })}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Pattern">
          {(id) => (
            <select id={id} value={draft.pattern ?? ''} onChange={(e) => set({ pattern: e.target.value || null })} className={inputClass}>
              <option value="">—</option>
              {PATTERNS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Fabric">
          {(id) => (
            <select id={id} value={draft.material ?? ''} onChange={(e) => set({ material: e.target.value || null })} className={inputClass}>
              <option value="">—</option>
              {MATERIALS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Fit">
          {(id) => (
            <select id={id} value={draft.fit ?? ''} onChange={(e) => set({ fit: e.target.value || null })} className={inputClass}>
              <option value="">—</option>
              {FITS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
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
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <Chip key={s} active={draft.styles?.includes(s)} onClick={() => set({ styles: toggle(draft.styles, s, 3) })} className="h-8 px-3 text-[13px]">
              {s}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
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
        {(id) => <textarea id={id} rows={2} value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} className={inputClass} maxLength={160} />}
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
    const patch = { ...draft, name: (draft.name ?? '').trim(), aiStatus: item.aiStatus === 'pending' ? 'pending' : 'done' }
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

  const footer = editing ? (
    <div className="flex gap-2">
      {item.category && (
        <Button variant="secondary" onClick={() => setEditing(false)} className="flex-1">
          Cancel
        </Button>
      )}
      <Button onClick={save} disabled={!draft?.category} className="flex-1">
        {draft?.category ? 'Save' : 'Pick a type to save'}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      <Button onClick={() => onStyle(item)} disabled={!item.category || pending}>
        <Sparkles className="size-4" /> Style this piece
      </Button>
      <div className="grid grid-cols-4 gap-2">
        <QuickAction
          label={item.favorite ? 'Loved' : 'Love'}
          active={item.favorite}
          onClick={() => actions.updateItem(item.id, { favorite: !item.favorite })}
          icon={<Heart className={`size-5 ${item.favorite ? 'fill-current text-selvedge' : ''}`} />}
        />
        <QuickAction
          label={item.laundry ? 'In wash' : 'To wash'}
          active={item.laundry}
          disabled={!washable(item.category) && !item.laundry}
          onClick={() => {
            actions.setLaundry([item.id], !item.laundry)
            showToast({ message: item.laundry ? 'Back in the closet' : 'Moved to the laundry' })
          }}
          icon={<WashingMachine className="size-5" />}
        />
        <QuickAction label="Edit" onClick={() => setEditing(true)} icon={<Pencil className="size-5" />} />
        <QuickAction label="Delete" onClick={remove} icon={<Trash2 className="size-5" />} danger />
      </div>
    </div>
  )

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit piece' : item.name || (pending ? 'New piece' : 'Untitled piece')} footer={footer} wide>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl bg-board">
            <ItemImage item={item} full fit="contain" className={`aspect-[4/5] w-full sm:max-h-none ${editing ? 'max-h-[24dvh]' : 'max-h-[40dvh]'}`} />
          </div>
          {!editing && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Worn" value={`${item.wearCount ?? 0}×`} />
              <Stat label="Last worn" value={relativeDays(item.lastWorn, todayKey())} />
              <Stat label="Per wear" value={cpw ? formatPrice(cpw) : item.price ? formatPrice(item.price) : '—'} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {pending && (
            <Notice className="flex items-center gap-3">
              <Spinner className="size-4 text-accent" /> Claude is tagging this piece…
            </Notice>
          )}
          {failed && (
            <Notice tone="warn" className="flex flex-col gap-3">
              <p>{item.aiError || 'Claude couldn’t tag this piece.'}</p>
              {canTag && (
                <Button size="sm" variant="secondary" className="self-start" onClick={() => uploader.retag(item)}>
                  <RefreshCw className="size-4" /> Retry tagging
                </Button>
              )}
            </Notice>
          )}
          {!canTag && !item.category && !pending && (
            <Notice>Tag this piece so it can go into outfits. On claude.ai, Claude does this from the photo.</Notice>
          )}

          {editing && draft ? (
            <EditForm draft={draft} setDraft={setDraft} />
          ) : (
            item.category && (
              <>
                {item.description && <p className="text-[15px] text-ink-2">{item.description}</p>}
                <Details item={item} />
                {item.laundry && <p className="label text-muted">In the laundry · left out of outfit ideas</p>}
                {canTag && !pending && (
                  <button type="button" onClick={() => uploader.retag(item)} className="label inline-flex items-center gap-1.5 self-start text-muted hover:text-ink">
                    <RefreshCw className="size-3.5" /> Re-tag from photo
                  </button>
                )}
              </>
            )
          )}
        </div>
      </div>
    </Sheet>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-raised px-2 py-2">
      <span className="label text-muted">{label}</span>
      <span className="truncate text-[15px] font-semibold tnum">{value}</span>
    </div>
  )
}

function QuickAction({ label, icon, onClick, active, danger, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-40 ${
        danger ? 'border-line text-critical hover:bg-critical/10' : active ? 'border-ink/40 bg-raised text-ink' : 'border-line text-ink-2 hover:bg-raised hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
