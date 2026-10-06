import { CircleNotch, X } from '@phosphor-icons/react'
import { useEffect, useId, useRef } from 'react'
import { colorHex, colorLabel } from '../lib/vocab.js'

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const base =
    'condensed inline-flex items-center justify-center gap-2 rounded-sm whitespace-nowrap transition-[background-color,color,border-color,transform,filter] active:translate-y-px disabled:opacity-40 disabled:active:translate-y-0'
  const sizes = { sm: 'h-9 px-3.5 text-[13px]', md: 'h-11 px-5 text-[15px]', lg: 'h-14 px-7 text-[18px]' }
  const styles = {
    primary: 'bg-accent text-on-accent hover:brightness-110',
    secondary: 'border-[1.5px] border-ink/70 text-ink hover:border-ink hover:bg-ink/5',
    ghost: 'text-ink-2 hover:bg-raised hover:text-ink',
    danger: 'border-[1.5px] border-critical/60 text-critical hover:bg-critical/10',
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
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-raised hover:text-ink disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

/** A toggleable tag. */
export function Chip({ active, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm border-[1.5px] px-3 text-[14px] font-semibold whitespace-nowrap transition-colors active:translate-y-px ${
        active ? 'border-ink bg-ink text-page' : 'border-line text-ink-2 hover:border-ink/50 hover:text-ink'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Swatch({ color, size = 14, className = '' }) {
  return (
    <span
      title={colorLabel(color)}
      className={`inline-block shrink-0 rounded-full ring-1 ring-ink/25 ${className}`}
      style={{ width: size, height: size, background: colorHex(color) }}
    />
  )
}

export function Swatches({ colors = [], size = 12 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {colors.slice(0, 3).map((c) => (
        <Swatch key={c} color={c} size={size} />
      ))}
    </span>
  )
}

export function Spinner({ className = 'size-4' }) {
  return <CircleNotch weight="bold" className={`animate-spin ${className}`} aria-hidden="true" />
}

/** Label above the control, hint below. `children` may be a function of the control's id. */
export function Field({ label, hint, children, className = '' }) {
  const id = useId()
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-[14px] font-semibold text-ink">
        {label}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'w-full min-w-0 rounded-sm border-[1.5px] border-line bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-accent focus:outline-none'

/** One-of-N buttons, for small scales (formality, warmth). */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-0 rounded-sm border-[1.5px] px-1 py-2 text-[12.5px] leading-tight font-semibold transition-colors ${
            value === o.value ? 'border-ink bg-ink text-page' : 'border-line text-ink-2 hover:border-ink/50'
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
      <div className="absolute inset-0 bg-scrim backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`sheet-up relative flex max-h-[92dvh] w-full flex-col rounded-t-sm border-t-[3px] border-accent bg-page shadow-card outline-none sm:rounded-sm ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <h2 id={titleId} className="display min-w-0 flex-1 truncate pb-0.5 text-[30px]">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X weight="bold" className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

/** Big condensed page title, with an optional orange count tucked in like a size tag. */
export function PageTitle({ children, count, sub, aside }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-2.5">
        <h1 className="display text-[64px] sm:text-[96px]">
          {children}
          {count != null && <sup className="ml-1.5 align-super text-[0.32em] tracking-normal text-accent-ink tnum">{count}</sup>}
        </h1>
        {sub && <p className="max-w-[52ch] text-[15px] text-ink-2">{sub}</p>}
      </div>
      {aside}
    </div>
  )
}

/** A titled block within a tab. */
export function Section({ title, aside, children, className = '' }) {
  return (
    <section className={`flex flex-col gap-4 ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          {title && <h2 className="display text-[34px] sm:text-[40px]">{title}</h2>}
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
    warn: 'border-warn bg-warn/10 text-ink',
    error: 'border-critical bg-critical/10 text-ink',
  }
  return <div className={`rounded-sm border-l-[3px] px-4 py-3 text-[14px] ${tones[tone]} ${className}`}>{children}</div>
}
