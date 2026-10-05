import { useEffect, useId, useRef } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { colorHex, colorLabel } from '../lib/vocab.js'

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,color,border-color,transform] active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100'
  const sizes = { sm: 'h-9 px-3.5 text-[13px]', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-6 text-base' }
  const styles = {
    primary: 'bg-accent text-on-accent hover:bg-accent/90',
    secondary: 'border border-line bg-surface text-ink hover:border-ink/30',
    ghost: 'text-ink-2 hover:bg-raised hover:text-ink',
    danger: 'border border-critical/40 bg-surface text-critical hover:bg-critical/10',
  }
  return (
    <button type="button" className={`${base} ${sizes[size]} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function IconButton({ label, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-raised hover:text-ink disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** A toggleable pill. */
export function Chip({ active, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium whitespace-nowrap transition-colors ${
        active ? 'border-ink bg-ink text-page' : 'border-line bg-surface text-ink-2 hover:border-ink/35 hover:text-ink'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Swatch({ color, size = 14, ring = true, className = '' }) {
  return (
    <span
      title={colorLabel(color)}
      className={`inline-block shrink-0 rounded-full ${ring ? 'ring-1 ring-ink/20' : ''} ${className}`}
      style={{ width: size, height: size, background: colorHex(color) }}
    />
  )
}

export function Swatches({ colors = [], size = 12 }) {
  return (
    <span className="inline-flex items-center -space-x-1">
      {colors.slice(0, 3).map((c) => (
        <span key={c} className="inline-flex rounded-full bg-surface p-[1.5px]">
          <Swatch color={c} size={size} />
        </span>
      ))}
    </span>
  )
}

export function Spinner({ className = 'size-4' }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-hidden="true" />
}

export function Field({ label, hint, children, className = '' }) {
  const id = useId()
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="label text-muted">
        {label}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'

/** One-of-N buttons, for small scales (formality, warmth). */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col overflow-hidden rounded-xl border border-line bg-surface">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-0 px-1 py-2 text-[12.5px] leading-tight font-medium transition-colors not-first:border-l not-first:border-line ${
            value === o.value ? 'bg-ink text-page' : 'text-ink-2 hover:bg-raised'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * A bottom sheet on phones, a centred dialog on wider screens.
 * Escape and the scrim close it; focus moves inside on open.
 */
export function Sheet({ open, onClose, title, children, footer, wide = false }) {
  const panel = useRef(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    panel.current?.focus({ preventScroll: true })
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.({ preventScroll: true })
    }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`sheet-up relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-page shadow-card outline-none sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 pt-4 pb-3">
          <h2 id={titleId} className="min-w-0 flex-1 truncate font-display text-[22px] leading-tight font-semibold">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

/** A titled block within a tab. */
export function Section({ title, aside, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-3">
          {title && <h2 className="font-display text-[22px] leading-tight font-semibold">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

export function Notice({ tone = 'info', children, className = '' }) {
  const tones = {
    info: 'border-line bg-surface text-ink-2',
    warn: 'border-warn/40 bg-warn/10 text-ink',
    error: 'border-critical/40 bg-critical/10 text-ink',
  }
  return <div className={`rounded-2xl border px-4 py-3 text-[14px] ${tones[tone]} ${className}`}>{children}</div>
}
