import type { Member } from '../../data/types'
import { useStore } from '../../data/store'
import { useT } from '../../i18n'
import { SquadPulseCard } from '../squad/SquadPulseCard'
import { CoachNote } from './CoachNote'
import { CoachSetup } from './CoachSetup'
import { HomeHeader } from './HomeHeader'
import { LatestCard } from './LatestCard'
import { SquadTodayCard } from './SquadTodayCard'
import { fmtEyebrowDate } from './format'
import { useCoach, useNow, useSquadData, useToday, useUnseenCount } from './hooks'
import { useInboxSlot } from './InboxSlot'
import { HM } from './messages'

/** SquadPulseCard shows the newest two feed items; the latest card continues from there. */
const PULSE_FEED_ITEMS = 2

/**
 * Coach home (a coach who doesn't train the program): set-up checklist for a new squad, cheers, "Squad today"
 * with nudges, the squad pulse and the latest activity.
 */
export function CoachHome({ me }: { me: Member }) {
  const t = useT(HM)
  const now = useNow()
  const today = useToday(now)
  const data = useSquadData()
  const feedData = useSquadData(true)
  const otherCoach = useCoach(me.id)
  const unseen = useUnseenCount(me.id)
  const { slot, onBell } = useInboxSlot(unseen)
  const athletes = useStore((s) => {
    let n = 0
    for (const m of Object.values(s.members)) if (m.role === 'athlete') n++
    return n
  })
  const date = fmtEyebrowDate(today)
  const eyebrow = athletes ? `${date} · ${athletes === 1 ? t('athleteOne') : t('athletesN', { n: athletes })}` : date

  return (
    <div className="home home--coach">
      <HomeHeader me={me} now={now} eyebrow={eyebrow} unseen={unseen} onBell={onBell} />
      <div className="home-grid">
        <div className="home-col">
          <CoachSetup />
          <CoachNote me={me} coach={otherCoach} now={now} />
          {slot}
          <SquadTodayCard data={data} today={today} meId={me.id} />
          <SquadPulseCard />
        </div>
        <div className="home-col">
          <LatestCard data={feedData} me={me} now={now} skip={PULSE_FEED_ITEMS} />
        </div>
      </div>
    </div>
  )
}
