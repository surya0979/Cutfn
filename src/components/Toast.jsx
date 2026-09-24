import { Check, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A short confirmation after logging something, with an Undo button.
 * show({ message, onUndo }) replaces any toast already on screen.
 */
export function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const show = useCallback((next) => {
    clearTimeout(timer.current)
    setToast({ ...next, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 4500)
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
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 flex justify-center px-4 lg:bottom-6">
      <div
        key={toast.key}
        role="status"
        className="pointer-events-auto flex max-w-md animate-[toast-in_180ms_ease-out] items-center gap-3 rounded-xl bg-raised py-2.5 pl-3.5 pr-2 text-sm shadow-2xl shadow-black/50 ring-1 ring-line"
      >
        <Check className="size-4 shrink-0 text-good-ink" aria-hidden />
        <span className="min-w-0 truncate">{toast.message}</span>
        {toast.onUndo && (
          <button
            type="button"
            onClick={() => {
              toast.onUndo()
              onDismiss()
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-volt hover:bg-page"
          >
            <Undo2 className="size-3.5" aria-hidden /> Undo
          </button>
        )}
      </div>
    </div>
  )
}
