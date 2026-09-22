import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import type { ISODate } from '../../lib/dates'
import type { MemberStats } from '../../lib/stats'
import { StatTile } from '../../ui'
import { fmtMonth } from './format'
import { onSchedulePct, prsInMonth } from './logic/tiles'
import { HM } from './messages'

/** Week streak, on-schedule % and PRs this month: three tiles that link to where the numbers come from. */
export function StatTiles({ me, stats, today }: { me: Member; stats: MemberStats; today: ISODate }) {
  const t = useT(HM)
  const pct = onSchedulePct(stats)
  const prs = prsInMonth(stats.prs, today)
  const month = fmtMonth(today)
  return (
    <ul className="grid-3 home-tiles" aria-label={t('tilesLabel')}>
      <li>
        <StatTile to="/train" icon="flame" value={stats.weekStreak} unit={t('wk')} label={t('weekStreak')} />
      </li>
      <li>
        <StatTile
          to="/train"
          icon="calendar-check"
          value={
            pct == null ? (
              <>
                <span aria-hidden="true">–</span>
                <span className="visually-hidden">{t('notYet')}</span>
              </>
            ) : (
              pct
            )
          }
          unit={pct == null ? undefined : '%'}
          label={t('onSchedule')}
        />
      </li>
      <li>
        <StatTile to={`/member/${encodeURIComponent(me.slug)}`} icon="trophy" value={prs} label={t('prsIn', { month })} />
      </li>
    </ul>
  )
}
