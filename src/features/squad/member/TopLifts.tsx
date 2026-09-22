import { Link } from 'react-router'
import type { Member, Unit } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtNum } from '../../../lib/format'
import { kgToUnit } from '../../../lib/units'
import { Card, CardHeader, EmptyState, Icon } from '../../../ui'
import { liftHref } from '../format'
import type { TopLift } from '../logic/lifts'
import { SQ } from '../messages'

/** Strongest lifts by estimated 1RM, each linking to the lift's history. */
export function TopLifts({ member, lifts, unit, isMe }: { member: Member; lifts: TopLift[]; unit: Unit; isMe: boolean }) {
  const t = useT(SQ)
  const best = lifts[0]?.bestE1rmKg ?? 1
  return (
    <Card as="section" className="sq-lifts" aria-labelledby="sq-lifts-h">
      <CardHeader title={<span id="sq-lifts-h">{t('topLifts')}</span>} subtitle={t('topLiftsSub')} />
      {lifts.length ? (
        <ol className="sq-lifts__list">
          {lifts.map((l) => (
            <li key={l.name}>
              <Link to={liftHref(member, l.name)} className="sq-lift">
                <span className="sq-lift__main">
                  <span className="sq-lift__name">{l.name}</span>
                  <span className="sq-lift__set">
                    <span className="sq-lift__set-l">{t('bestSetLabel')}</span>
                    <span className="num">
                      {fmtNum(kgToUnit(l.kg, unit), 1)}
                      <i className="mul">×</i>
                      {l.reps}
                    </span>
                  </span>
                  <span className="sq-lift__bar" aria-hidden="true">
                    <i style={{ width: `${(l.bestE1rmKg / best) * 100}%` }} />
                  </span>
                </span>
                <span className="sq-lift__e1rm">
                  <span className="num">{fmtNum(kgToUnit(l.bestE1rmKg, unit), 0)}</span>
                  <small>{unit}</small>
                </span>
                <Icon name="chevron-right" size={16} className="sq-lift__chev" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState compact icon="dumbbell-plate" title={t('noWorkoutsTitle')} body={isMe ? t('noLiftsSelf') : t('noLiftsOther')} />
      )}
    </Card>
  )
}
