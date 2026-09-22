import { useId } from 'react'
import type { CheckinRating } from '../../data/types'
import { useT } from '../../i18n'
import { Card, Icon, TextField, type IconName } from '../../ui'
import { FM } from './messages'
import { WaterGlasses } from './WaterGlasses'

const RATINGS: { value: CheckinRating; icon: IconName }[] = [
  { value: 'on', icon: 'check' },
  { value: 'mostly', icon: 'minus' },
  { value: 'off', icon: 'x' },
]

export interface CheckinCardProps {
  isToday: boolean
  rating: CheckinRating | null
  waterL: number | null
  waterTargetL: number | null
  note: string
  /** The viewer is the coach logging their own day: the note is for themselves, not "for your coach". */
  coachSelf?: boolean
  readOnly?: boolean
  onRate: (r: CheckinRating) => void
  onWater: (litres: number) => void
  onNote: (text: string) => void
}

/** The day's overall rating, water glasses and a note for the coach. */
export function CheckinCard(p: CheckinCardProps) {
  const t = useT(FM)
  const headId = useId()
  return (
    <Card as="section" className="fu-checkin" aria-labelledby={headId}>
      <div className="fu-checkin__head">
        <h2 id={headId} className="fu-h">
          {p.isToday ? t('howToday') : t('howDay')}
        </h2>
        {!p.rating && <p className="fu-hint">{t('rateHint')}</p>}
      </div>
      <div className="fu-rate" role="group" aria-labelledby={headId}>
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`fu-rate__btn fu-rate__btn--${r.value}${p.rating === r.value ? ' is-on' : ''}`}
            aria-pressed={p.rating === r.value}
            disabled={p.readOnly}
            onClick={() => p.onRate(r.value)}
          >
            <span className="fu-rate__ic" aria-hidden="true">
              <Icon name={r.icon} size={16} strokeWidth={2.4} />
            </span>
            <span>{t(r.value)}</span>
          </button>
        ))}
      </div>
      <WaterGlasses valueL={p.waterL} targetL={p.waterTargetL} readOnly={p.readOnly} onChange={p.onWater} />
      <TextField
        label={t('note')}
        placeholder={p.coachSelf ? t('notePhSelf') : t('notePh')}
        value={p.note}
        maxLength={280}
        disabled={p.readOnly}
        onChange={(e) => p.onNote(e.target.value)}
      />
    </Card>
  )
}
