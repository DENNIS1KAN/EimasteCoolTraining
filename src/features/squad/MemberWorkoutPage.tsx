import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import type { Member, Program, WorkoutLog } from '../../data/types'
import { dayShortName } from '../../data/programs'
import { useMe, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { isoFromMs } from '../../lib/dates'
import { fmtDate } from '../../lib/format'
import { logId } from '../../lib/ids'
import { Avatar, ButtonLink, Card, EmptyState, Icon, PageHeader, Tag } from '../../ui'
import { FEEL_KEYS, SessionStats } from '../train/DoneCard'
import { ReadOnlyExercise } from '../train/WorkoutView'
import { fmtTime, textLang } from '../train/logic/format'
import { clampRef } from '../train/logic/program'
import { workoutView } from '../train/logic/view'
import { LIFT, M } from '../train/messages'
import { KudosBar } from './KudosBar'
import '../train/train.css'
import '../train/lift.css'

/**
 * /member/:slug/workout/:week/:day[?program=<programId>]: a read-only view of a member's (or my) logged workout.
 * `?program=` names the program the log belongs to (it can be an older one after a program change); without it,
 * or when that program is unknown, the member's current program.
 */
export default function MemberWorkoutPage() {
  const l = useT(LIFT)
  const params = useParams()
  const [search] = useSearchParams()
  const me = useMe()
  const member = useStore((s) => Object.values(s.members).find((m) => m.slug === params.slug) ?? null)
  const asked = search.get('program')
  const program = useStore((s) => (asked ? s.programs[asked] : undefined) ?? (member?.programId ? s.programs[member.programId] : undefined) ?? null)
  if (!me) return null
  if (!member || !program || !program.weeks.length) {
    return (
      <div className="tr-page">
        <PageHeader back title={l('notFound')} />
        <Card>
          <EmptyState icon="search" title={l('notFound')} body={l('notFoundBody')} action={<ButtonLink to="/squad">{l('backSquad')}</ButtonLink>} />
        </Card>
      </div>
    )
  }
  const ref = clampRef(program, Number(params.week), Number(params.day))
  return <MemberWorkout me={me} member={member} program={program} week={ref.week} day={ref.day} />
}

function MemberWorkout({ me, member, program, week, day }: { me: Member; member: Member; program: Program; week: number; day: number }) {
  const t = useT(M)
  const l = useT(LIFT)
  const id = logId(member.id, program.id, week, day)
  const log = useStore((s) => s.logs[id] ?? null)
  const programs = useStore((s) => s.programs)
  const memberLogs = useStore((s) => Object.values(s.logs).filter((x) => x.memberId === member.id))
  const pweek = program.weeks[week - 1]
  const pday = pweek.days[day]
  const view = useMemo(() => workoutView(log, program, week, day, memberLogs, programs), [log, program, week, day, memberLogs, programs])
  const unit = me.settings.unit
  const isMe = me.id === member.id
  /** Train logs the current program only, so an older program's workout is view-only even for its owner. */
  const canEdit = isMe && program.id === member.programId
  const prs = view.reduce((a, x) => a + x.sets.filter((s) => s.pr).length, 0)
  const logged = !!log && view.some((x) => !x.skipped)
  const title = t('dayTitle', { day: dayShortName(pday) })

  return (
    <div className="tr-page mw-page">
      <PageHeader
        back
        eyebrow={l('workoutEyebrow', { name: member.name, week })}
        title={<span lang={textLang(title)}>{title}</span>}
        actions={
          <Link to={`/member/${member.slug}`} className="lf-avatar" aria-label={member.name}>
            <Avatar member={member} size={40} you={isMe} decorative />
          </Link>
        }
      />
      {log && (logged || log.done) ? (
        <Summary log={log} program={program} unit={unit} prs={prs} member={member} isMe={isMe} canEdit={canEdit} />
      ) : (
        <Card>
          <EmptyState
            icon="calendar"
            title={l('notLogged')}
            body={l('notLoggedBody')}
            action={
              canEdit ? (
                <ButtonLink to={`/train/${week}/${day}`} icon="edit">
                  {l('edit')}
                </ButtonLink>
              ) : undefined
            }
          />
        </Card>
      )}
      {logged ? (
        <div className="tr-list">
          {view.map((x) => (
            <ReadOnlyExercise key={x.index} x={x} e={pday.ex[x.index]} total={pday.ex.length} intro={pweek.intro} unit={unit} slug={member.slug} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Summary(p: { log: WorkoutLog; program: Program; unit: 'kg' | 'lb'; prs: number; member: Member; isMe: boolean; canEdit: boolean }) {
  const { log, program, unit, prs, member, isMe, canEdit } = p
  const t = useT(M)
  const l = useT(LIFT)
  const at = log.doneAt ?? log.startedAt ?? log.updatedAt
  const feelKey = log.feel ? (FEEL_KEYS[Math.round(log.feel) - 1] ?? null) : null
  return (
    <Card as="section" className="tr-done mw-sum" aria-label={log.done ? t('doneTitle') : l('inProgress')}>
      <div className="mw-sum__top">
        {log.done ? (
          <Tag tone="accent" icon="check">
            {t('done')}
          </Tag>
        ) : (
          <Tag tone="warn" icon="clock">
            {l('inProgress')}
          </Tag>
        )}
        <span className="mw-sum__when">
          {fmtDate(isoFromMs(at), 'long')} · {fmtTime(at)}
        </span>
      </div>
      <SessionStats log={log} program={program} unit={unit} prs={prs} />
      {feelKey || log.note ? (
        <p className="tr-done__note">
          {feelKey ? (
            <b>
              {l('feel')}: {t(feelKey)}
            </b>
          ) : null}
          {feelKey && log.note ? ' · ' : null}
          {log.note ? <span>“{log.note}”</span> : null}
        </p>
      ) : null}
      {log.done ? <KudosBar itemId={`workout:${log.id}`} toId={member.id} /> : null}
      {canEdit ? (
        <ButtonLink to={`/train/${log.week}/${log.day}`} variant="secondary" size="sm" icon="edit" className="mw-sum__edit">
          {l('edit')}
        </ButtonLink>
      ) : null}
      {!log.done && !isMe ? (
        <p className="mw-sum__live">
          <Icon name="bolt" size={14} /> {l('inProgress')}
        </p>
      ) : null}
    </Card>
  )
}
