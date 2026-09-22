import { useMemo } from 'react'
import { useMe, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { addDays } from '../../lib/dates'
import { fmtSigned } from '../../lib/format'
import { kgToUnit } from '../../lib/units'
import { BigNumber, Card, Delta, Icon, memberColorVar } from '../../ui'
import { Sparkline } from '../../ui/charts'
import { useWeightModel } from './hooks'
import { dirOf, toneOf, weightModeFor } from './logic'
import { M } from './messages'
import { pctSigned, wAbs, wNum, wText } from './format'
import './body.css'

/**
 * Home 2-up mini card: "WEIGHT", the trend value, a delta pill since start and a 30-day sparkline.
 * For someone else it follows their visibility: change-only shows the change instead of kilos; private shows a lock.
 * Tapping opens /body for the viewer.
 */
export function WeightMiniCard({ memberId }: { memberId: string }) {
  const t = useT(M)
  const me = useMe()
  const member = useStore((s) => s.members[memberId] ?? null)
  const model = useWeightModel(member)
  const self = !!me && me.id === memberId
  const unit = me?.settings.unit ?? member?.settings.unit ?? 'kg'
  const color = memberColorVar(member?.color)
  const mode = member ? weightModeFor(me, member) : 'hidden'
  const stats = model.stats

  const spark = useMemo(() => {
    const from = addDays(model.today, -29)
    const pts = model.series.filter((p) => p.date >= from)
    return pts.map((p, i) => ({ x: i, y: p.trendKg }))
  }, [model.series, model.today])

  if (!member) return <Card className="body-mini" aria-hidden="true" />

  let body
  if (mode === 'hidden') {
    body = (
      <>
        <div className="body-mini__head">
          <p className="eyebrow">{t('miniTitle')}</p>
        </div>
        <p className="body-mini__lock">
          <Icon name="lock" size={16} />
          {t('private')}
        </p>
      </>
    )
  } else if (!stats) {
    body = (
      <>
        <div className="body-mini__head">
          <p className="eyebrow">{t('miniTitle')}</p>
        </div>
        {self ? (
          <p className="body-mini__cta">
            <span className="body-mini__cta-icon" aria-hidden="true">
              <Icon name="plus" size={16} strokeWidth={2.4} />
            </span>
            {t('miniEmptySelf')}
          </p>
        ) : (
          <p className="body-mini__empty">{t('miniEmpty')}</p>
        )}
      </>
    )
  } else {
    const change = stats.changeKg
    const exact = mode === 'exact'
    const deltaText = exact ? wAbs(change, unit) : pctSigned(stats.changePct)
    const ariaFrom = spark.length ? spark[0].y : stats.trendKg
    body = (
      <>
        <div className="body-mini__head">
          <p className="eyebrow">{t('miniTitle')}</p>
          {stats.entries > 1 && <Delta text={deltaText} dir={dirOf(change)} tone={toneOf(change, model.phase)} />}
        </div>
        {exact ? (
          <BigNumber className="body-mini__value" value={wNum(stats.trendKg, unit)} unit={unit} size="md" />
        ) : (
          <BigNumber className="body-mini__value" value={fmtSigned(kgToUnit(change, unit), 1)} unit={unit} size="md" />
        )}
        {spark.length > 1 && (
          <Sparkline
            className="body-mini__spark"
            values={spark}
            color={color}
            height={34}
            ariaLabel={exact ? t('sparkAria', { name: member.name, from: wText(ariaFrom, unit), to: wText(stats.trendKg, unit) }) : t('changeOnly')}
          />
        )}
      </>
    )
  }

  return self ? (
    <Card to="/body" className="body-mini">
      {body}
    </Card>
  ) : (
    <Card className="body-mini">{body}</Card>
  )
}
