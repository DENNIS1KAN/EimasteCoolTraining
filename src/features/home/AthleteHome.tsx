import { useMemo } from 'react'
import type { Member } from '../../data/types'
import { useStore } from '../../data/store'
import { useT } from '../../i18n'
import { memberStats, programWeekOn } from '../../lib/stats'
import { fmtDate } from '../../lib/format'
import { TodayWorkoutCard } from '../train/TodayWorkoutCard'
import { WeightMiniCard } from '../body/WeightMiniCard'
import { TodayNutritionCard } from '../fuel/TodayNutritionCard'
import { SquadPulseCard } from '../squad/SquadPulseCard'
import { AthleteOnboarding } from './AthleteOnboarding'
import { CoachNote } from './CoachNote'
import { HomeHeader } from './HomeHeader'
import { SquadTodayCard } from './SquadTodayCard'
import { StatTiles } from './StatTiles'
import { WeighInPrompt } from './WeighInPrompt'
import { fmtEyebrowDate } from './format'
import { useCoach, useNow, useSquadData, useToday, useUnseenCount } from './hooks'
import { useInboxSlot } from './InboxSlot'
import { hasTrainingStats } from './logic/tiles'
import { HM } from './messages'

/**
 * Athlete home: greeting, onboarding (fresh accounts), coach note, cheers, today's workout (hero), the three
 * stat tiles, weight + fuel minis and the squad pulse. Desktop: training on the left, body/food/squad on the right.
 */
export function AthleteHome({ me }: { me: Member }) {
  const t = useT(HM)
  const now = useNow()
  const today = useToday(now)
  const data = useSquadData()
  const stats = useMemo(() => memberStats(data, me.id, today), [data, me.id, today])
  const coach = useCoach(me.id)
  const unseen = useUnseenCount(me.id)
  const { slot, onBell } = useInboxSlot(unseen)
  const program = useStore((s) => (me.programId ? (s.programs[me.programId] ?? null) : null))

  const date = fmtEyebrowDate(today)
  let when: string | null = null
  if (program && me.programStart) {
    when =
      me.programStart > today
        ? t('startsOn', { date: fmtDate(me.programStart) })
        : t('weekOf', { n: programWeekOn(program, me.programStart, today), total: program.weeks.length })
  }

  return (
    <div className="home">
      <HomeHeader me={me} now={now} eyebrow={when ? `${date} · ${when}` : date} unseen={unseen} onBell={onBell} />
      <div className="home-grid">
        <div className="home-col">
          <AthleteOnboarding me={me} coach={coach} />
          <CoachNote me={me} coach={coach} now={now} />
          {slot}
          <TodayWorkoutCard />
          {hasTrainingStats(stats) ? <StatTiles me={me} stats={stats} today={today} /> : null}
        </div>
        <div className="home-col">
          <WeighInPrompt me={me} today={today} now={now} />
          <div className="grid-2 home-minis">
            <WeightMiniCard memberId={me.id} />
            <TodayNutritionCard memberId={me.id} />
          </div>
          <SquadPulseCard />
          {me.role === 'coach' ? <SquadTodayCard data={data} today={today} meId={me.id} /> : null}
        </div>
      </div>
    </div>
  )
}
