import { Bookmark, CalendarDays, Cloud, HardDrive, Shirt, SlidersHorizontal, Sparkles } from 'lucide-react'

export const TABS = [
  { id: 'closet', label: 'Closet', icon: Shirt },
  { id: 'style', label: 'Style me', icon: Sparkles },
  { id: 'looks', label: 'Saved', icon: Bookmark },
  { id: 'history', label: 'History', icon: CalendarDays },
]

function SyncBadge({ mode }) {
  if (mode === 'connecting') return <span className="label text-muted">Connecting…</span>
  const cloud = mode === 'cloud'
  const Icon = cloud ? Cloud : HardDrive
  return (
    <span
      className="label inline-flex items-center gap-1.5 text-muted"
      title={cloud ? 'Synced across your devices through claude.ai' : 'Saved in this browser only'}
    >
      <Icon className={`size-3.5 ${cloud ? 'text-good' : ''}`} aria-hidden />
      <span className="hidden sm:inline">{cloud ? 'Synced' : 'This device'}</span>
    </span>
  )
}

export default function Header({ tab, onTab, mode, onSettings }) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 bg-page/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <button type="button" onClick={() => onTab('closet')} className="flex items-baseline gap-2" aria-label="Fitfn, go to closet">
          <span className="font-display text-[28px] leading-none font-bold tracking-tight italic">Fitfn</span>
        </button>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-[15px] font-semibold transition-colors ${tab === t.id ? 'bg-ink text-page' : 'text-ink-2 hover:bg-raised hover:text-ink'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SyncBadge mode={mode} />
          <button
            type="button"
            onClick={onSettings}
            aria-label="Style profile"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[14px] font-semibold text-ink-2 hover:text-ink"
          >
            <SlidersHorizontal className="size-4" aria-hidden /> <span className="hidden sm:inline">Style profile</span>
            <span className="sm:hidden">Profile</span>
          </button>
        </div>
      </div>
      <div className="selvedge" />
    </header>
  )
}

export function BottomNav({ tab, onTab }) {
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden"
    >
      <div className="grid grid-cols-4">
        {TABS.map((t) => {
          const Icon = t.icon
          const on = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={on ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11.5px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}
            >
              <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${on ? 'bg-ink text-page' : ''}`}>
                <Icon className="size-[18px]" aria-hidden />
              </span>
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
