import { useMemo, useState, type JSX, type ReactNode } from 'react'
import type { Member, Program } from '../../data/types'
import { dayShortName, daysPerWeek } from '../../data/programs'
import { useMe, useStore } from '../../data/store'
import { useT, type Vars } from '../../i18n'
import { addDays, todayISO } from '../../lib/dates'
import { fmtClock, fmtDate, fmtDayLabel } from '../../lib/format'
import { bestE1rmByExercise, sessionSummary, type WorkoutRef } from '../../lib/stats'
import { ButtonLink, Button, Card, Icon, ProgressBar, Sheet, WeekDots, cx, memberColorVar, type IconName, type WeekDotItem } from '../../ui'
import { StartProgramForm } from './StartProgram'
import { useMemberLogs, useNow } from './hooks'
import { fmtTime, textLang, upperText } from './logic/format'
import { dayProgress } from './logic/log'
import { doneKeys, estimateMinutes, focusOf, weekDayStates } from './logic/program'
import { logPRs } from './logic/prs'
import { heroWeek, todayState, type TodayState } from './logic/today'
import { TODAY } from './messages'
import { useProgramName } from './programText'
import './train.css'

type TT = (k: keyof typeof TODAY.en, vars?: Vars) => string

/**
 * Home screen hero ("night island"): today's workout with this program week's day dots, and a single clear next
 * action for every situation: not started, rest day, behind schedule, in progress, done today, program complete.
 */
export function TodayWorkoutCard(): JSX.Element {
  const me = useMe()
  const program = useStore((s) => (me?.programId ? (s.programs[me.programId] ?? null) : null))
  if (!me) return <></>
  return <Hero me={me} program={program} />
}

function Hero({ me, program }: { me: Member; program: Program | null }) {
  const t = useT(TODAY)
  const programName = useProgramName(program ?? { name: '' })
  const logs = useMemberLogs(me.id)
  const programs = useStore((s) => s.programs)
  const now = useNow(30_000)
  const today = todayISO(new Date(now))
  const mine = useMemo(() => (program ? logs.filter((l) => l.programId === program.id) : []), [logs, program])
  const state = useMemo(() => todayState({ member: me, program, logs: mine, today, now }), [me, program, mine, today, now])
  const [startOpen, setStartOpen] = useState(false)
  const doneLog = state.kind === 'done-today' ? state.log : null
  const donePRs = useMemo(
    () => (doneLog && program ? logPRs(doneLog, program, bestE1rmByExercise(logs, programs, doneLog.id)).length : 0),
    [doneLog, program, logs, programs],
  )

  if (!program || state.kind === 'no-program') {
    return (
      <HeroShell me={me} eyebrow={t('notStarted')} dots={null}>
        <h2 className="tr-hero__title tr-hero__title--sm">{t('noProgram')}</h2>
        <p className="tr-hero__line">{me.role === 'coach' ? t('noProgramCoach') : t('noProgramBody')}</p>
        {me.role === 'coach' ? (
          <ButtonLink to={`/coach/member/${me.slug}`} block variant="secondary" icon="whistle">
            {t('openCoach')}
          </ButtonLink>
        ) : null}
      </HeroShell>
    )
  }

  const week = heroWeek(program, me.programStart, today, 'next' in state ? (state.next as WorkoutRef | null) : null)
  const done = doneKeys(mine, program.id)
  const states = weekDayStates(program, me.programStart, week, done, today)
  const dots: WeekDotItem[] = (program.weeks[week - 1]?.days ?? []).map((d, i) => ({
    label: upperText(dayShortName(d).charAt(0)),
    title: dayShortName(d),
    state: states[i],
  }))
  const dotsLabel = t('weekDots', { week, done: dots.filter((d) => d.state === 'done').length, total: dots.length })
  const dayOf = (r: WorkoutRef) => program.weeks[r.week - 1]?.days[r.day]
  const focusWord = (r: WorkoutRef) => {
    const f = focusOf(dayOf(r) ?? { name: '' })
    return f === 'str' ? t('focusStr') : f === 'hyp' ? t('focusHyp') : null
  }
  const when = (date: string | null) => (!date ? '' : date === addDays(today, 1) ? t('tomorrow') : fmtDayLabel(date))
  const meta = (r: WorkoutRef) => {
    const d = dayOf(r)
    return d ? [{ icon: 'list' as const, text: t('exercisesN', { n: d.ex.length }) }, { icon: 'clock' as const, text: t('minutes', { n: estimateMinutes(d) }) }] : []
  }
  const shell = (p: { eyebrow: ReactNode; live?: boolean; children: ReactNode }) => (
    <HeroShell me={me} eyebrow={p.eyebrow} live={p.live} dots={{ items: dots, label: dotsLabel }}>
      {p.children}
    </HeroShell>
  )

  switch (state.kind) {
    case 'in-progress': {
      const d = dayOf(state.ref)!
      const p = dayProgress(state.log, d)
      const started = state.log.startedAt
      return shell({
        eyebrow: started ? `${t('inProgress')} · ${fmtClock(now - started)}` : t('inProgress'),
        live: true,
        children: (
          <>
            <Mid program title={dayShortName(d)} meta={[{ icon: 'check', text: t('setsDone', { done: p.setsDone, total: p.setsTotal }) }, ...meta(state.ref).slice(0, 1)]} />
            <ProgressBar value={p.setsTotal ? p.setsDone / p.setsTotal : 0} color="var(--accent)" height={4} label={t('setsDone', { done: p.setsDone, total: p.setsTotal })} className="tr-hero__bar" />
            <ButtonLink to={`/train/${state.ref.week}/${state.ref.day}`} block icon="play">
              {t('continue')}
            </ButtonLink>
          </>
        ),
      })
    }
    case 'done-today':
      return (
        <DoneToday
          me={me}
          program={program}
          state={state}
          t={t}
          shell={shell}
          when={when}
          prs={donePRs}
        />
      )
    case 'complete':
      return shell({
        eyebrow: t('complete'),
        children: (
          <>
            <Mid title={t('completeTitle')} icon="trophy" meta={[]} />
            <p className="tr-hero__line">{t('completeBody', { n: state.done })}</p>
            <ButtonLink to={`/member/${me.slug}`} block variant="secondary" iconRight="arrow-right">
              {t('seeLifts')}
            </ButtonLink>
          </>
        ),
      })
    case 'not-started':
      return (
        <>
          {shell({
            eyebrow: programName,
            children: (
              <>
                <Mid title={t('ready')} meta={[]} />
                <p className="tr-hero__line">{t('readyBody', { weeks: program.weeks.length, perWeek: daysPerWeek(program) })}</p>
                <div className="tr-hero__actions">
                  <Button block icon="calendar-check" onClick={() => setStartOpen(true)}>
                    {t('setStart')}
                  </Button>
                  <ButtonLink to="/train/1/0" variant="ghost" size="sm" className="tr-hero__ghost">
                    {t('preview')}
                  </ButtonLink>
                </div>
              </>
            ),
          })}
          <Sheet open={startOpen} onClose={() => setStartOpen(false)} title={t('startSheetTitle')} subtitle={programName}>
            <StartProgramForm me={me} program={program} onSaved={() => setStartOpen(false)} />
          </Sheet>
        </>
      )
    case 'starts-soon':
      return shell({
        eyebrow: state.inDays === 1 ? t('startsTomorrow') : t('startsIn', { n: state.inDays }),
        children: (
          <>
            <Mid program title={dayShortName(dayOf(state.next)!)} meta={meta(state.next)} />
            <p className="tr-hero__line">{t('startsOn', { date: fmtDate(state.start, 'long') })}</p>
            <ButtonLink to={`/train/${state.next.week}/${state.next.day}`} block variant="secondary" icon="eye">
              {t('preview')}
            </ButtonLink>
          </>
        ),
      })
    case 'rest': {
      const nd = dayOf(state.next)!
      return shell({
        eyebrow: t('restDay'),
        children: (
          <>
            <Mid title={t('restTitle')} meta={[]} />
            <p className="tr-hero__line">
              <Icon name="calendar" size={16} />
              {t('nextUp', { name: dayShortName(nd), when: when(state.nextDate) })}
            </p>
            <ButtonLink to={`/train/${state.next.week}/${state.next.day}`} block variant="secondary" icon="play">
              {t('trainAnyway')}
            </ButtonLink>
          </>
        ),
      })
    }
    case 'train': {
      const d = dayOf(state.ref)!
      const f = focusWord(state.ref)
      return shell({
        // Behind schedule: the warning line below says "catch up", so the eyebrow only names the focus.
        eyebrow: state.scheduledToday ? (f ? t('todayFocus', { focus: f }) : t('today')) : (f ?? t('catchUp')),
        live: true,
        children: (
          <>
            <Mid program title={dayShortName(d)} meta={meta(state.ref)} />
            {state.behindBy > 0 ? (
              <p className="tr-hero__line tr-hero__line--warn">
                <Icon name="alert" size={16} />
                {state.behindBy === 1 ? t('behindOne') : t('behindMany', { n: state.behindBy })}
              </p>
            ) : null}
            <ButtonLink to={`/train/${state.ref.week}/${state.ref.day}`} block icon="play">
              {t('start')}
            </ButtonLink>
          </>
        ),
      })
    }
    default:
      return shell({ eyebrow: '', children: null })
  }
}

function DoneToday(p: {
  me: Member
  program: Program
  state: Extract<TodayState, { kind: 'done-today' }>
  t: TT
  shell: (p: { eyebrow: ReactNode; live?: boolean; children: ReactNode }) => JSX.Element
  when: (d: string | null) => string
  prs: number
}) {
  const { program, state, t } = p
  const d = program.weeks[state.ref.week - 1]?.days[state.ref.day]
  const nd = state.next ? program.weeks[state.next.week - 1]?.days[state.next.day] : null
  const doneAt = state.log.doneAt ?? state.log.updatedAt
  const counted = sessionSummary(state.log, program).setsDone
  return p.shell({
    eyebrow: t('doneToday'),
    children: (
      <>
        <Mid
          program
          title={d ? dayShortName(d) : ''}
          icon="check"
          meta={[
            { icon: 'list', text: t('setsLogged', { n: counted }) },
            ...(p.prs ? [{ icon: 'trophy' as const, text: p.prs === 1 ? t('onePr') : t('prs', { n: p.prs }) }] : []),
          ]}
        />
        <p className="tr-hero__line">
          <Icon name="clock" size={16} />
          {t('finishedAt', { time: fmtTime(doneAt) })}
          {nd && state.next ? ` · ${t('nextAfter', { name: dayShortName(nd), when: state.nextDate ? p.when(state.nextDate) : t('today') })}` : ''}
        </p>
        <ButtonLink to={`/train/${state.ref.week}/${state.ref.day}`} block variant="secondary" iconRight="arrow-right">
          {t('view')}
        </ButtonLink>
      </>
    ),
  })
}

function HeroShell(p: {
  me: Member
  eyebrow: ReactNode
  live?: boolean
  dots: { items: WeekDotItem[]; label: string } | null
  children: ReactNode
}) {
  return (
    <Card as="section" night glow={memberColorVar(p.me.color)} className="tr-hero" aria-label={typeof p.eyebrow === 'string' ? p.eyebrow : undefined}>
      <div className="tr-hero__top">
        <p className={cx('tr-hero__eyebrow', p.live && 'is-live')}>
          {p.live ? <i aria-hidden="true" /> : null}
          <span>{p.eyebrow}</span>
        </p>
        {p.dots && p.dots.items.length ? <WeekDots items={p.dots.items} label={p.dots.label} /> : null}
      </div>
      {p.children}
    </Card>
  )
}

/** `program`: the title is a program day name (English or Greek, whatever the UI language), tagged for uppercase and speech. */
function Mid({ title, meta, icon, program }: { title: string; meta: { icon: IconName; text: string }[]; icon?: IconName; program?: boolean }) {
  return (
    <div className="tr-hero__mid">
      <h2 className="tr-hero__title" lang={program ? textLang(title) : undefined}>
        {icon ? (
          <span className="tr-hero__badge" aria-hidden="true">
            <Icon name={icon} size={26} strokeWidth={2.6} />
          </span>
        ) : null}
        {title}
      </h2>
      {meta.length ? (
        <ul className="tr-hero__meta">
          {meta.map((m, i) => (
            <li key={i}>
              <Icon name={m.icon} size={16} />
              {m.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
