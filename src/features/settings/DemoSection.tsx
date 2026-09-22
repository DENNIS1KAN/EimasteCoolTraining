import { useState } from 'react'
import { useT } from '../../i18n'
import { getBackend } from '../../data/store'
import type { LocalBackend } from '../../data/backend/local'
import { ConfirmSheet, Icon, type IconName } from '../../ui'
import { SETTINGS, type SettingsKey } from './messages'
import { Section } from './Section'

type Action = 'reset' | 'empty'

const ROWS: { action: Action; icon: IconName; title: SettingsKey; body: SettingsKey }[] = [
  { action: 'reset', icon: 'refresh', title: 'resetDemo', body: 'resetDemoBody' },
  { action: 'empty', icon: 'trash', title: 'startEmpty', body: 'startEmptyBody' },
]

/** Demo mode only: bring the sample data back, or keep the profiles and start from zero. */
export function DemoSection() {
  const t = useT(SETTINGS)
  const [open, setOpen] = useState<Action | null>(null)
  const [last, setLast] = useState<Action>('reset')

  const run = (withDemoData: boolean) => {
    const b = getBackend()
    if (b.kind !== 'demo') return
    ;(b as LocalBackend).reset(withDemoData)
    location.reload()
  }

  const ask = (a: Action) => {
    setLast(a)
    setOpen(a)
  }

  return (
    <Section id="demo" icon="sparkles" title={t('demo')} sub={t('demoSub')}>
      <div className="set-rows">
        {ROWS.map((r) => (
          <button
            key={r.action}
            type="button"
            className={['set-row', r.action === 'empty' && 'set-row--danger'].filter(Boolean).join(' ')}
            onClick={() => ask(r.action)}
          >
            <span className="set-row__icon" aria-hidden="true">
              <Icon name={r.icon} size={18} />
            </span>
            <span className="set-row__text">
              <span className="set-row__title">{t(r.title)}</span>
              <span className="set-row__sub">{t(r.body)}</span>
            </span>
            <Icon name="chevron-right" size={18} className="set-row__chev" />
          </button>
        ))}
      </div>
      <ConfirmSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={last === 'reset' ? t('resetTitle') : t('emptyTitle')}
        body={last === 'reset' ? t('resetBody') : t('emptyBody')}
        confirmLabel={last === 'reset' ? t('reset') : t('clear')}
        danger
        onConfirm={() => run(last === 'reset')}
      />
    </Section>
  )
}
