import { useState } from 'react'
import type { Member, WeightEntry } from '../../data/types'
import { useT } from '../../i18n'
import { COMMON } from '../../i18n/common'
import { fmtDate, fmtNum } from '../../lib/format'
import { weighInStreak } from '../../lib/stats'
import { Button, Icon, Stepper, celebrate, cx, toast } from '../../ui'
import { saveWeighIn } from './actions'
import type { WeightModel } from './hooks'
import { fromDisplay, stepperStart, WEIGHT_LIMITS } from './logic'
import { M } from './messages'
import { wText } from './format'
import { WeightEntrySheet } from './WeightEntrySheet'

const STREAK_MILESTONES = new Set([7, 14, 21, 30, 60, 90])

/** Feedback after a weigh-in: a small celebration on streak milestones. */
export function celebrateStreak(entries: WeightEntry[], memberId: string, date: string, today: string, streakText: (n: number) => string) {
  if (date !== today) return
  const n = weighInStreak([...entries, { memberId, date: today } as WeightEntry], today)
  if (STREAK_MILESTONES.has(n)) {
    celebrate({ intensity: 'small' })
    toast(streakText(n), { tone: 'good' })
  }
}

/**
 * Quick log: floating above the tab bar on phones (a card in the side column on desktop).
 * Stepper prefilled with the last weigh-in and a volt save; once today is logged it collapses to "Logged … · Edit".
 */
export function QuickLogDock({ member, model, variant }: { member: Member; model: WeightModel; variant: 'dock' | 'card' }) {
  const t = useT(M)
  const tc = useT(COMMON)
  const unit = member.settings.unit
  const lim = WEIGHT_LIMITS[unit]
  const { today, entries, latest } = model
  const todayEntry = entries.find((e) => e.date === today) ?? null
  const [value, setValue] = useState<number | null>(null)
  const [sheet, setSheet] = useState<null | 'log' | 'edit'>(null)
  const shown = value ?? stepperStart(latest?.kg, unit)
  const first = !latest

  const onSaved = (_kg: number, date: string) => {
    setValue(null)
    celebrateStreak(entries, member.id, date, today, (n) => t('streak', { n }))
  }

  const quickSave = () => {
    const kg = fromDisplay(shown, unit)
    const undo = saveWeighIn({ memberId: member.id, date: today, kg, bodyFat: null, waistCm: null, note: '' })
    toast(t('savedToast', { value: wText(kg, unit) }), { tone: 'good', action: { label: t('undo'), onClick: undo } })
    onSaved(kg, today)
  }

  const cls = cx('body-dock', variant === 'card' && 'body-dock--card')
  return (
    <>
      {todayEntry ? (
        <div className={cx(cls, 'body-dock--done')} role="region" aria-label={t('logToday')}>
          <span className="body-dock__done" aria-hidden="true">
            <Icon name="check" size={18} strokeWidth={2.6} />
          </span>
          <p className="body-dock__label body-dock__logged">{t('loggedToday', { value: wText(todayEntry.kg, unit) })}</p>
          <Button variant="ghost" size="sm" icon="edit" onClick={() => setSheet('edit')}>
            {tc('edit')}
          </Button>
        </div>
      ) : (
        <div className={cls} role="region" aria-label={t('logToday')}>
          <button type="button" className="body-dock__label body-dock__open" onClick={() => setSheet('log')} aria-haspopup="dialog">
            <b className="body-dock__title">
              {t('logToday')}
              <Icon name="chevron-up" size={14} strokeWidth={2.2} />
            </b>
            <span className={first ? 'body-dock__sub--wrap' : undefined}>
              {first ? t('tapToType') : `${fmtDate(today, 'weekday')} ${fmtDate(today, 'dayMonth')}`}
            </span>
          </button>
          <Stepper
            value={shown}
            onChange={setValue}
            step={0.1}
            min={lim.min}
            max={lim.max}
            format={(n) => fmtNum(n, 1, 1)}
            unit={unit}
            label={t('weightLabel')}
          />
          <button type="button" className="body-dock__save" onClick={quickSave} aria-label={t('saveWeight')}>
            <Icon name="check" size={24} strokeWidth={2.4} />
          </button>
        </div>
      )}
      <WeightEntrySheet
        open={sheet != null}
        onClose={() => setSheet(null)}
        memberId={member.id}
        unit={unit}
        entry={sheet === 'edit' ? todayEntry : null}
        startValue={shown}
        onSaved={onSaved}
      />
    </>
  )
}
