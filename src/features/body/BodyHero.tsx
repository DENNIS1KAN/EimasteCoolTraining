import type { Unit } from '../../data/types'
import { useT } from '../../i18n'
import { fmtDate, fmtDayLabel, fmtSigned } from '../../lib/format'
import { weighInStreak } from '../../lib/stats'
import { kgToUnit } from '../../lib/units'
import { BigNumber, Chip, Delta } from '../../ui'
import type { WeightModel } from './hooks'
import { dirOf, toneOf } from './logic'
import { M } from './messages'
import { wAbs, wNum, wText } from './format'

/** The big trend number with the change since start, the weekly rate and the latest raw weigh-in. */
export function BodyHero({ model, unit }: { model: WeightModel; unit: Unit }) {
  const t = useT(M)
  const { stats, latest, phase, entries, today } = model
  if (!stats || !latest) return null
  const change = stats.changeKg
  const rate = stats.weeklyRateKg
  const streak = weighInStreak(entries, today)
  const showDelta = stats.entries > 1
  return (
    <section className="body-hero" aria-labelledby="body-hero-label">
      <p className="eyebrow" id="body-hero-label" title={t('trendHelp')}>
        {t('trendWeight')}
      </p>
      <div className="body-hero__row">
        <BigNumber value={wNum(stats.trendKg, unit)} unit={unit} size="xxl" className="body-hero__value" />
        <div className="body-hero__side">
          {showDelta && (
            <div className="body-hero__stat">
              <Delta text={wAbs(change, unit)} dir={dirOf(change)} tone={toneOf(change, phase)} />
              <p className="body-hero__k">{t('since', { date: fmtDate(stats.startDate, 'dayMonth') })}</p>
            </div>
          )}
          <div className="body-hero__stat">
            <p className="body-hero__rate num">
              {rate == null ? '–' : fmtSigned(kgToUnit(rate, unit), 1)}
              <small>{t('perWeek', { unit })}</small>
            </p>
            <p className="body-hero__k">{rate == null ? `${t('weeklyRate')} · ${t('rateLater')}` : t('weeklyRate')}</p>
          </div>
        </div>
      </div>
      <div className="body-hero__meta">
        <p className="body-hero__last">{t('lastWeighIn', { value: wText(latest.kg, unit), when: fmtDayLabel(latest.date) })}</p>
        {streak >= 2 && (
          <Chip size="sm" icon="flame" tone="accent">
            {t('streak', { n: streak })}
          </Chip>
        )}
      </div>
    </section>
  )
}
