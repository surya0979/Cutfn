import { useEffect, useState } from 'react'
import { toDateKey } from './dates.js'

/** Today's date key, rolling over at local midnight even if the tab stays open. */
export function useToday() {
  const [today, setToday] = useState(toDateKey)
  useEffect(() => {
    const check = () => setToday(toDateKey())
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}
