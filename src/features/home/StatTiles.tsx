import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import type { ISODate } from '../../lib/dates'
import type { MemberStats } from '../../lib/stats'
import { StatTile } from '../../ui'
import { fmtMonth } from './format'
import { hasTrainingStats, onSchedulePct, prsInMonth } from './logic/tiles'
import { HM } from './messages'

/**
 * Week streak, on-schedule % and PRs this month: three tiles that link to where the numbers come from.
 * Before the first workout the tiles keep their shape and read "–": a zero is a result, a dash is "not yet".
 */
export function StatTiles({ me, stats, today }: { me: Member; stats: MemberStats; today: ISODate }) {
  const t = useT(HM)
  const started = hasTrainingStats(stats)
  const pct = onSchedulePct(stats)
  const prs = prsInMonth(stats.prs, today)
  const month = fmtMonth(today)
  const notYet = (
    <>
      <span aria-hidden="true">–</span>
      <span className="visually-hidden">{t('notYet')}</span>
    </>
  )
  return (
    <ul className="grid-3 home-tiles" aria-label={t('tilesLabel')}>
      <li>
        <StatTile
          to="/train"
          icon="flame"
          className={started ? undefined : 'ui-tile--empty'}
          value={started ? stats.weekStreak : notYet}
          unit={started ? t('wk') : undefined}
          label={t('weekStreak')}
        />
      </li>
      <li>
        <StatTile
          to="/train"
          icon="calendar-check"
          className={pct == null ? 'ui-tile--empty' : undefined}
          value={pct == null ? notYet : pct}
          unit={pct == null ? undefined : '%'}
          label={t('onSchedule')}
        />
      </li>
      <li>
        <StatTile
          to={`/member/${encodeURIComponent(me.slug)}`}
          icon="trophy"
          className={started ? undefined : 'ui-tile--empty'}
          value={started ? prs : notYet}
          label={t('prsIn', { month })}
        />
      </li>
    </ul>
  )
}
