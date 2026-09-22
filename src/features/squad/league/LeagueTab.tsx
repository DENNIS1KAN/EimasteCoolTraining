import { useMemo, useState } from 'react'
import { useT } from '../../../i18n'
import { EmptyState, Segmented } from '../../../ui'
import { useSquad, useSquadDataWithCheers } from '../hooks'
import { categoryLeaders, standings, type LeaguePeriod } from '../logic/league'
import { SQ } from '../messages'
import { BadgeShelf } from './BadgeShelf'
import { CategoryLeaders } from './CategoryLeaders'
import { PointsExplainer } from './PointsExplainer'
import { Standings } from './Standings'

export function LeagueTab() {
  const t = useT(SQ)
  const { me, today, data, stats, competitors } = useSquad()
  const withCheers = useSquadDataWithCheers()
  const [period, setPeriod] = useState<LeaguePeriod>('week')
  const ids = useMemo(() => competitors.map((m) => m.id), [competitors])
  const rows = useMemo(() => standings(data, ids, period, today), [data, ids, period, today])
  const allTimeZero = useMemo(() => standings(data, ids, 'all', today).every((r) => r.points.total === 0), [data, ids, today])
  const cats = useMemo(() => categoryLeaders(ids.map((id) => stats[id]).filter(Boolean)), [ids, stats])

  if (!competitors.length) return <EmptyState icon="trophy" title={t('emptySquadTitle')} body={t('emptySquadBody')} />

  return (
    <div className="sq-league">
      <div className="stack sq-league__main">
        <Standings
          rows={rows}
          members={data.members}
          meId={me?.id ?? null}
          action={
            <Segmented
              size="sm"
              ariaLabel={t('periodLabel')}
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'week', label: t('periodWeek') },
                { value: 'all', label: t('periodAll') },
              ]}
            />
          }
        />
        <PointsExplainer defaultOpen={allTimeZero} />
      </div>
      <div className="stack sq-league__side">
        <CategoryLeaders cats={cats} members={data.members} meId={me?.id ?? null} unit={me?.settings.unit ?? 'kg'} />
        <BadgeShelf data={withCheers} members={competitors} meId={me?.id ?? null} />
      </div>
    </div>
  )
}
