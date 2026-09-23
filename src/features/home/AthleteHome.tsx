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
import { SquadChatCard } from './SquadChatCard'
import { AthleteOnboarding } from './AthleteOnboarding'
import { CoachSetup } from './CoachSetup'
import { HomeHeader } from './HomeHeader'
import { SquadTodayCard } from './SquadTodayCard'
import { StatTiles } from './StatTiles'
import { WeighInPrompt } from './WeighInPrompt'
import { fmtEyebrowDate } from './format'
import { useCoach, useNow, useSquadData, useToday, useUnseenCount } from './hooks'
import { useInboxSlot } from './InboxSlot'
import { HM } from './messages'

/**
 * Athlete home, also the home of a coach who trains and competes (the default; he also gets the squad set-up
 * checklist and "Squad today" with a link to the coach console): greeting, onboarding (fresh accounts), coach note, cheers, today's workout (hero), the three
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
          {me.role === 'coach' ? <CoachSetup /> : null}
          <AthleteOnboarding me={me} coach={coach} />
          {slot}
          <TodayWorkoutCard />
          <StatTiles me={me} stats={stats} today={today} />
        </div>
        <div className="home-col">
          <WeighInPrompt me={me} today={today} now={now} />
          <div className="grid-2 home-minis">
            <WeightMiniCard memberId={me.id} />
            <TodayNutritionCard memberId={me.id} />
          </div>
          <SquadPulseCard />
          <SquadChatCard />
          {me.role === 'coach' ? <SquadTodayCard data={data} today={today} meId={me.id} /> : null}
        </div>
      </div>
    </div>
  )
}
