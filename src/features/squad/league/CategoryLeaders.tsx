import type { Member, Unit } from '../../../data/types'
import { useT } from '../../../i18n'
import { Avatar, AvatarStack, Icon, SectionTitle, type IconName } from '../../../ui'
import { fmtList } from '../format'
import type { CategoryKey, CategoryLeader } from '../logic/league'
import { fmtMetric } from '../logic/metrics'
import { SQ } from '../messages'

const META: Record<CategoryKey, { label: 'catConsistency' | 'catVolumeWeek' | 'catPrs30' | 'catStrength' | 'catNutrition' | 'catGoal'; icon: IconName }> = {
  consistency: { label: 'catConsistency', icon: 'calendar-check' },
  volumeWeek: { label: 'catVolumeWeek', icon: 'dumbbell-plate' },
  prs30: { label: 'catPrs30', icon: 'trophy' },
  strength: { label: 'catStrength', icon: 'bolt' },
  nutrition: { label: 'catNutrition', icon: 'fuel' },
  goal: { label: 'catGoal', icon: 'target' },
}

/** Six small trophies: who leads each category, with the runner-up underneath. */
export function CategoryLeaders({ cats, members, meId, unit }: { cats: CategoryLeader[]; members: Record<string, Member>; meId: string | null; unit: Unit }) {
  const t = useT(SQ)
  const name = (id: string) => (id === meId ? t('youCap') : (members[id]?.name ?? '?'))
  const inline = (id: string) => (id === meId ? t('youLabel') : (members[id]?.name ?? '?'))
  return (
    <section className="stack" aria-labelledby="sq-cats-h">
      <SectionTitle title={<span id="sq-cats-h">{t('categoryLeaders')}</span>} />
      <ul className="sq-cats">
        {cats.map((c) => {
          const meta = META[c.key]
          const leaders = c.leaders.map((id) => members[id]).filter(Boolean)
          const next = c.ranking.find((r) => r.rank > 1)
          return (
            <li key={c.key} className={`ui-card sq-cat${leaders.length ? '' : ' is-open'}`}>
              <p className="sq-cat__label">
                <Icon name={meta.icon} size={16} />
                <span>{t(meta.label)}</span>
              </p>
              {leaders.length ? (
                <>
                  <div className="sq-cat__leader">
                    {leaders.length === 1 ? <Avatar member={leaders[0]} size={32} decorative /> : <AvatarStack members={leaders} size={32} max={3} />}
                    <span className="sq-cat__who truncate">{fmtList(c.leaders.map(name))}</span>
                  </div>
                  <p className="sq-cat__value num">{fmtMetric(c.key, c.value, unit)}</p>
                  {next && leaders.length === 1 ? (
                    <p className="sq-cat__next">{t('runnerUp', { name: inline(next.memberId), value: fmtMetric(c.key, next.value, unit) })}</p>
                  ) : null}
                </>
              ) : (
                <p className="sq-cat__open">{t('upForGrabs')}</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
