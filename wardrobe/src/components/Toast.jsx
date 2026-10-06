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

/** A black slab with Courier text. Undo is the one action. */
export default function Toast({ toast, onDismiss }) {
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-[60] flex justify-center px-4 md:bottom-6">
      <div key={toast.key} role="status" className="slam pointer-events-auto flex max-w-md items-stretch border-4 border-ink bg-ink text-[15px] font-bold text-page">
        <span className="px-3 py-2.5">{toast.message}</span>
        {toast.onUndo && (
          <button
            type="button"
            onClick={() => {
              toast.onUndo()
              onDismiss()
            }}
            className="display shrink-0 border-l-4 border-page bg-page px-3 text-[18px] text-ink"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  )
}
