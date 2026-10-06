import { BookmarkSimple, CalendarBlank, CloudCheck, CoatHanger, HardDrives, MagicWand, SlidersHorizontal } from '@phosphor-icons/react'

export const TABS = [
  { id: 'closet', label: 'Closet', icon: CoatHanger },
  { id: 'style', label: 'Style me', icon: MagicWand },
  { id: 'looks', label: 'Saved', icon: BookmarkSimple },
  { id: 'history', label: 'History', icon: CalendarBlank },
]

function SyncBadge({ mode }) {
  if (mode === 'connecting') return <span className="meta text-muted">Connecting</span>
  const cloud = mode === 'cloud'
  const Icon = cloud ? CloudCheck : HardDrives
  return (
    <span className="meta inline-flex items-center gap-1.5 text-muted" title={cloud ? 'Synced across your devices through claude.ai' : 'Saved in this browser only'}>
      <Icon weight="bold" className={`size-4 ${cloud ? 'text-good' : ''}`} aria-hidden />
      <span className="hidden sm:inline">{cloud ? 'Synced' : 'This device'}</span>
    </span>
  )
}

export default function Header({ tab, onTab, mode, onSettings }) {
  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line bg-page/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <button type="button" onClick={() => onTab('closet')} className="display text-[34px] leading-none" aria-label="Fitfn, go to closet">
          Fit<span className="text-accent">fn</span>
        </button>
        <nav className="hidden h-full items-stretch gap-1 md:flex" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`condensed relative px-3 text-[16px] transition-colors ${tab === t.id ? 'text-ink' : 'text-muted hover:text-ink'}`}
            >
              {t.label}
              <span className={`absolute inset-x-3 bottom-0 h-[3px] bg-accent transition-transform ${tab === t.id ? 'scale-x-100' : 'scale-x-0'}`} />
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SyncBadge mode={mode} />
          <button
            type="button"
            onClick={onSettings}
            aria-label="Style profile"
            className="condensed inline-flex h-10 items-center gap-2 rounded-sm border-[1.5px] border-line px-3 text-[14px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            <SlidersHorizontal weight="bold" className="size-4" aria-hidden />
            <span className="hidden sm:inline">Style profile</span>
            <span className="sm:hidden">Profile</span>
          </button>
        </div>
      </div>
    </header>
  )
}

export function BottomNav({ tab, onTab }) {
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md md:hidden">
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
              className={`condensed relative flex flex-col items-center gap-1 pt-3 pb-2.5 text-[12px] transition-colors ${on ? 'text-ink' : 'text-muted'}`}
            >
              <span className={`absolute inset-x-5 top-0 h-[3px] bg-accent transition-transform ${on ? 'scale-x-100' : 'scale-x-0'}`} />
              <Icon weight={on ? 'fill' : 'regular'} className={`size-6 ${on ? 'text-accent' : ''}`} aria-hidden />
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
