import { useT } from '../../i18n'
import { Chip } from '../../ui'
import { SETTINGS, type SettingsKey } from './messages'

const ITEMS: { id: string; label: SettingsKey }[] = [
  { id: 'profile', label: 'profile' },
  { id: 'units', label: 'units' },
  { id: 'privacy', label: 'navPrivacy' },
  { id: 'appearance', label: 'appearance' },
  { id: 'workout', label: 'workout' },
  { id: 'account', label: 'account' },
  { id: 'data', label: 'navData' },
  { id: 'install', label: 'navApp' },
  { id: 'about', label: 'about' },
  { id: 'demo', label: 'navDemo' },
]

/** Phones: a scrollable row of chips that jump to each section of the (long) settings page. */
export function JumpNav({ demo }: { demo: boolean }) {
  const t = useT(SETTINGS)
  const go = (id: string) => {
    const el = document.getElementById(`settings-${id}`)
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }
  return (
    <nav className="settings__jump" aria-label={t('jumpTo')}>
      {ITEMS.filter((i) => demo || i.id !== 'demo').map((i) => (
        <Chip key={i.id} onClick={() => go(i.id)}>
          {t(i.label)}
        </Chip>
      ))}
    </nav>
  )
}
