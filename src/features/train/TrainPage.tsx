import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Member, Program } from '../../data/types'
import { useMe, useStore } from '../../data/store'
import { COMMON } from '../../i18n/common'
import { useT } from '../../i18n'
import { todayISO } from '../../lib/dates'
import { upcomingWorkout } from '../../lib/stats'
import { ButtonLink, Card, EmptyState, PageHeader } from '../../ui'
import { Logger } from './Logger'
import { useMemberLogs } from './hooks'
import { clampRef } from './logic/program'
import { liveLog } from './logic/today'
import { M } from './messages'
import './train.css'

/**
 * /train opens the session in progress, else the next workout (calendar-aligned: this week's first one not done,
 * so a missed week doesn't send you back in time), and pins it in the URL
 * so finishing it doesn't jump ahead; /train/:week/:day opens a specific one (week 1-based, day 0-based like
 * WorkoutLog).
 */
export default function TrainPage() {
  const me = useMe()
  const program = useStore((s) => (me?.programId ? (s.programs[me.programId] ?? null) : null))
  if (!me) return null
  if (!program || !program.weeks.length) return <NoProgram me={me} />
  return <TrainRoute me={me} program={program} />
}

function TrainRoute({ me, program }: { me: Member; program: Program }) {
  const params = useParams()
  const navigate = useNavigate()
  const logs = useMemberLogs(me.id)
  const hasParams = params.week != null && params.day != null
  const ref = useMemo(() => {
    if (hasParams) return clampRef(program, Number(params.week), Number(params.day))
    const mine = logs.filter((l) => l.programId === program.id)
    const live = liveLog(mine, Date.now())
    if (live) return { week: live.week, day: live.day }
    const n = upcomingWorkout(program, me.programStart, mine, todayISO())
    if (n) return n
    const last = program.weeks.length
    return { week: last, day: program.weeks[last - 1].days.length - 1 }
    // The default is picked once per visit: logs changing (e.g. finishing) must not move it.
  }, [hasParams, params.week, params.day, program])

  useEffect(() => {
    if (!hasParams || String(ref.week) !== params.week || String(ref.day) !== params.day) {
      navigate(`/train/${ref.week}/${ref.day}`, { replace: true })
    }
  }, [hasParams, ref, params.week, params.day, navigate])

  return <Logger key={`${program.id}:${ref.week}:${ref.day}`} me={me} program={program} week={ref.week} day={ref.day} />
}

function NoProgram({ me }: { me: Member }) {
  const t = useT(M)
  const c = useT(COMMON)
  const coach = me.role === 'coach'
  return (
    <div className="tr-page">
      <PageHeader title={c('train')} account />
      <Card>
        <EmptyState
          icon="train"
          title={t('noProgramTitle')}
          body={coach ? t('noProgramCoach') : t('noProgramBody')}
          action={
            coach ? (
              <ButtonLink to={`/coach/member/${me.slug}`} icon="whistle">
                {t('openCoach')}
              </ButtonLink>
            ) : undefined
          }
        />
      </Card>
    </div>
  )
}
