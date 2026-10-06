import { ArrowUUpLeft, Check } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A short confirmation with an optional Undo.
 * show({ message, onUndo }) replaces any toast already on screen.
 */
export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const show = useCallback((next) => {
    clearTimeout(timer.current)
    setToast({ ...next, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), next.onUndo ? 8000 : 4000)
  }, [])
  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])

  return { toast, show, dismiss }
}

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-[60] flex justify-center px-4 md:bottom-6">
      <div
        key={toast.key}
        role="status"
        className="rise pointer-events-auto flex max-w-md items-center gap-3 rounded-sm border-l-[3px] border-accent bg-ink py-2 pr-2 pl-3.5 text-[14px] font-medium text-page shadow-card"
      >
        <Check weight="bold" className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">{toast.message}</span>
        {toast.onUndo && (
          <button
            type="button"
            onClick={() => {
              toast.onUndo()
              onDismiss()
            }}
            className="condensed inline-flex shrink-0 items-center gap-1 rounded-sm px-3 py-1.5 text-[13px] text-page underline decoration-accent decoration-2 underline-offset-4 hover:bg-page/15"
          >
            <ArrowUUpLeft weight="bold" className="size-3.5" aria-hidden /> Undo
          </button>
        )}
      </div>
    </div>
  )
}
