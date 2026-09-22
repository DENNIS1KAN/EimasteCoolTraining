import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Member, Program, WorkoutLog } from '../../data/types'
import { dayShortName, exerciseName, restSeconds } from '../../data/programs'
import { flushNow, getState, put, update, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { todayISO } from '../../lib/dates'
import { fmtClock } from '../../lib/format'
import { logId } from '../../lib/ids'
import { usePrefs } from '../../lib/prefs'
import { bestE1rmByExercise, isPRSet, programWeekOn, refKey, upcomingWorkout, workoutOn } from '../../lib/stats'
import { Banner, Button, PageHeader, Tag, celebrate, cx, toast, useWakeLock } from '../../ui'
import { DayTabs } from './DayTabs'
import { DoneCard } from './DoneCard'
import { ExerciseCard, type ExerciseActions } from './ExerciseCard'
import { FinishSheet, type FinishInput } from './FinishSheet'
import { ProgressStrip } from './ProgressStrip'
import { RestTimerHost } from './RestTimer'
import { StartProgramCard } from './StartProgram'
import { WeekStrip } from './WeekStrip'
import { useMemberLogs, useNow } from './hooks'
import {
  addSet,
  dayProgress,
  emptyLog,
  exerciseLog,
  finishLog,
  machineSuggestions,
  nextUp,
  rememberMachine,
  removeSet,
  setField,
  setMachine,
  setVariant,
  tickSet,
  unfinishLog,
  type NextUp,
} from './logic/log'
import { buildHistoryIndex, fillPlaceholderWeights, previousPerformance } from './logic/previous'
import { doneKeys, weekCompletion } from './logic/program'
import { logPRs } from './logic/prs'
import { startRest, stopRest, useRest } from './logic/restTimer'
import { textLang } from './logic/format'
import { lastSetTechnique } from './logic/techniques'
import { M } from './messages'
import { scrollBehavior, scrollToId } from './scroll'

/** A session left open longer than this is not "live" any more (no clock, no wake lock). */
const LIVE_MS = 5 * 60 * 60 * 1000

export const programShortName = (p: Program): string => p.name.split('·')[0].trim() || p.name

/** Anything typed or ticked (a workout that hasn't been touched has nothing to finish yet). */
const hasActivity = (l: WorkoutLog | null): boolean =>
  !!l && (!!l.startedAt || Object.values(l.ex).some((x) => x.sets.some((s) => s.ok || !!s.w.trim() || !!s.r.trim())))

interface Props {
  me: Member
  program: Program
  week: number
  day: number
}

/** The workout logger for one program day. Keyed by log id by the page, so local state resets per workout. */
export function Logger({ me, program, week, day }: Props) {
  const t = useT(M)
  const navigate = useNavigate()
  const prefs = usePrefs()
  const rest = useRest()
  const id = logId(me.id, program.id, week, day)
  const log = useStore((s) => s.logs[id] ?? null)
  const programs = useStore((s) => s.programs)
  const others = useMemberLogs(me.id, id)
  const pweek = program.weeks[week - 1]
  const pday = pweek.days[day]
  const unit = log?.unit ?? me.settings.unit
  const machines = me.settings.machines
  const today = todayISO()
  const logDone = !!log?.done

  /* ---------------------------------------------------------------- derived (memoized away from keystrokes) */
  const done = useMemo(() => {
    const s = doneKeys(others, program.id)
    if (logDone) s.add(refKey({ week, day }))
    return s
  }, [others, program.id, logDone, week, day])
  const completion = useMemo(() => weekCompletion(program, done), [program, done])
  const start = me.programStart
  const scheduled = start ? workoutOn(program, start, today) : null
  const todayIdx = scheduled && scheduled.week === week ? scheduled.day : -1
  const currentWeek = start ? programWeekOn(program, start, today) : 0
  const index = useMemo(() => buildHistoryIndex(others, programs), [others, programs])
  const priorBest = useMemo(() => bestE1rmByExercise(others, programs), [others, programs])
  const machineOptions = useMemo(() => machineSuggestions(me.settings, others), [me.settings, others])
  const variantKey = pday.ex.map((_, i) => log?.ex[String(i)]?.v ?? 0).join('')
  const prevs = useMemo(
    () =>
      pday.ex.map((e, i) =>
        previousPerformance(index, { id, programId: program.id, week, day }, exerciseName(e, Number(variantKey[i]) || 0), unit),
      ),
    [index, pday, variantKey, unit, id, program.id, week, day],
  )
  const progress = useMemo(() => dayProgress(log, pday), [log, pday])
  // Calendar-aligned "next": finishing a catch-up workout doesn't send you further back in time.
  const next = useMemo(
    () => (logDone && log ? upcomingWorkout(program, start, [...others.filter((l) => l.programId === program.id), log], today) : null),
    [logDone, log, others, program, start, today],
  )
  const donePRs = useMemo(() => (logDone && log ? logPRs(log, program, priorBest).length : 0), [logDone, log, program, priorBest])

  /* ---------------------------------------------------------------- session */
  const live = !!log?.startedAt && !log.done && Date.now() - log.startedAt < LIVE_MS
  const now = useNow(1000, live)
  useWakeLock(prefs.keepAwake && live)

  // Phone and desktop alike: only the current exercise is open, the rest are compact rows.
  const [open, setOpen] = useState<Set<number>>(() => {
    if (log?.done) return new Set()
    return new Set([Math.max(0, dayProgress(log, pday).current)])
  })
  const [finishOpen, setFinishOpen] = useState(false)

  /* ---------------------------------------------------------------- writes (read the latest state, never a stale closure) */
  const ctx = useRef({ me, program, week, day, pday, machines, priorBest, t })
  ctx.current = { me, program, week, day, pday, machines, priorBest, t }

  const actions = useMemo<ExerciseActions>(() => {
    const current = (): WorkoutLog => {
      const c = ctx.current
      return getState().logs[id] ?? emptyLog(c.me.id, c.program.id, c.week, c.day, c.me.settings.unit)
    }
    const commit = (nextLog: WorkoutLog, typing = false) => put('logs', nextLog, typing ? { debounceMs: 600 } : {})
    const ex = (i: number) => ctx.current.pday.ex[i]

    /**
     * Exercise `from` is complete: fold it and open `to`. Focus follows, so keyboard and screen-reader users land
     * on the new exercise instead of <body> (the focused check button disappears with the folded card): its first
     * open weight input after a keyboard tick, else the card itself (no on-screen keyboard popping up on phones).
     */
    const advance = (from: number, to: number, keyboard: boolean) => {
      setOpen((prev) => {
        const n = new Set(prev)
        n.delete(from)
        n.add(to)
        return n
      })
      setTimeout(() => {
        requestAnimationFrame(() => scrollToId(`ex-${to}`))
        const card = document.getElementById(`ex-${to}`)
        if (!card) return
        const active = document.activeElement
        const lost = !active || active === document.body || !active.isConnected
        if (keyboard) (card.querySelector<HTMLElement>('.tr-set:not(.is-done) input') ?? card).focus({ preventScroll: true })
        else if (lost) card.focus({ preventScroll: true })
      }, 60)
    }
    const caption = (log: WorkoutLog, up: NextUp): [string, string] => {
      const { t: tt, pday: d } = ctx.current
      if (up.kind === 'exercise') return [tt('nextExercise'), exerciseName(d.ex[up.exercise], log.ex[String(up.exercise)]?.v)]
      if (up.kind !== 'set') return [tt('next'), tt('nextFinish')]
      const n = up.set + 1
      const tech = lastSetTechnique(d.ex[up.exercise], ctx.current.program.weeks[ctx.current.week - 1].intro)
      if (up.last && tech && tech.key && tech.key !== 'stretch') return [tt('next'), tt('nextFail', { n })]
      return [tt('next'), up.last ? tt('nextLastSet', { n }) : tt('nextSet', { n })]
    }

    return {
      field: (i, j, f, v) => commit(setField(current(), i, ex(i), j, f, v, ctx.current.machines, Date.now()), true),
      tick: (i, j, ph, keyboard = false) => {
        const c = ctx.current
        const cur = current()
        const { log: nextLog, result } = tickSet(cur, i, ex(i), j, ph, c.machines, Date.now())
        if (nextLog !== cur) commit(nextLog)
        if (result !== 'ticked') return result
        const x = nextLog.ex[String(i)]
        if (isPRSet(x.sets[j], nextLog.unit, c.priorBest.get(exerciseName(ex(i), x.v)))) celebrate({ intensity: 'small' })
        if (nextLog.done) return result
        const up = nextUp(nextLog, c.pday, i, c.machines)
        if (up.kind === 'done') {
          stopRest()
          toast(c.t('allSetsDone'), { action: { label: c.t('finish'), onClick: () => setFinishOpen(true) }, duration: 9000 })
          return result
        }
        startRest({ seconds: restSeconds(ex(i).rest), next: caption(nextLog, up), route: `/train/${c.week}/${c.day}`, memberId: c.me.id })
        if (up.kind === 'exercise') advance(i, up.exercise, keyboard)
        return result
      },
      addSet: (i) => commit(addSet(current(), i, ex(i), ctx.current.machines)),
      removeSet: (i) => commit(removeSet(current(), i, ex(i), ctx.current.machines)),
      variant: (i, v) => commit(setVariant(current(), i, ex(i), v, ctx.current.machines)),
      machine: (i, value) => {
        const cur = current()
        const name = exerciseName(ex(i), cur.ex[String(i)]?.v)
        commit(setMachine(cur, i, ex(i), value, ctx.current.machines), true)
        update('members', ctx.current.me.id, (m) => ({ ...m, settings: rememberMachine(m.settings, name, value) }), { debounceMs: 600 })
      },
      aim: (i, w) => {
        const c = ctx.current
        let nextLog = current()
        exerciseLog(nextLog, i, ex(i), c.machines).sets.forEach((s, j) => {
          if (!s.ok && !s.w.trim()) nextLog = setField(nextLog, i, ex(i), j, 'w', w, c.machines, Date.now())
        })
        commit(nextLog)
        toast(c.t('aimFilled'))
      },
      toggle: (i) =>
        setOpen((prev) => {
          const n = new Set(prev)
          if (n.has(i)) n.delete(i)
          else n.add(i)
          return n
        }),
    }
  }, [id])

  const jump = (i: number) => {
    setOpen((prev) => new Set(prev).add(i))
    setTimeout(() => scrollToId(`ex-${i}`), 30)
  }

  // What finishing stores: reps typed under a grey "last time" weight take that weight (as a tick would).
  const toFinish = useMemo(() => (log ? fillPlaceholderWeights(log, pday, prevs) : null), [log, pday, prevs])

  const finish = (p: FinishInput) => {
    const cur = fillPlaceholderWeights(getState().logs[id] ?? emptyLog(me.id, program.id, week, day, me.settings.unit), pday, prevs)
    const prs = logPRs({ ...cur, done: true, doneAt: p.doneAt }, program, priorBest)
    put('logs', finishLog(cur, p))
    void flushNow()
    stopRest()
    setFinishOpen(false)
    setOpen(new Set())
    celebrate({ intensity: prs.length ? 'big' : 'small' })
    toast(prs.length > 1 ? t('prToast', { n: prs.length }) : prs.length ? t('prToastOne') : t('finishedToast'), { tone: 'good' })
    // After the sheet has closed (and handed focus back): land on the completion card.
    setTimeout(() => {
      document.getElementById('tr-top')?.scrollIntoView?.({ behavior: scrollBehavior(), block: 'start' })
      document.getElementById('tr-done-title')?.focus({ preventScroll: true })
    }, 0)
  }

  const undo = () => {
    const before = getState().logs[id]
    if (!before) return
    put('logs', unfinishLog(before))
    toast(t('markedNotDone'), {
      action: {
        label: t('undo'),
        onClick: () => {
          const cur = getState().logs[id]
          if (cur) put('logs', finishLog(cur, { doneAt: before.doneAt ?? Date.now(), feel: before.feel, note: before.note }))
        },
      },
    })
  }

  const go = (w: number, d: number) => navigate(`/train/${w}/${d}`, { replace: true })
  const clock = live && log?.startedAt ? fmtClock(now - log.startedAt) : ''
  const eyebrow = { program: programShortName(program), week, total: program.weeks.length }
  const title = t('dayTitle', { day: dayShortName(pday) })
  // "Finish" belongs to a session: in the header once something is logged, and always at the end of the list
  // (also for marking a workout done after the fact). Nothing to finish before the program has a start date.
  const canFinish = !!start && !logDone

  return (
    <div className="tr-page tr-logger" id="tr-top">
      <PageHeader
        className={cx('tr-head', live && 'is-live')}
        eyebrow={
          <>
            <span className="tr-head__eb">{t('eyebrow', eyebrow)}</span>
            <span className="tr-head__eb tr-head__eb--short">{t('eyebrowShort', eyebrow)}</span>
          </>
        }
        title={<span lang={textLang(title)}>{title}</span>}
        actions={
          <>
            {live ? (
              <span className="tr-live num" role="timer" aria-label={t('sessionTime', { t: clock })}>
                <i aria-hidden="true" />
                {clock}
              </span>
            ) : null}
            {logDone ? (
              <Tag tone="accent" icon="check">
                {t('done')}
              </Tag>
            ) : canFinish && hasActivity(log) ? (
              <Button variant="ghost" size="sm" onClick={() => setFinishOpen(true)}>
                {t('finish')}
              </Button>
            ) : null}
          </>
        }
      />

      {!start ? <StartProgramCard me={me} program={program} /> : null}

      <WeekStrip program={program} week={week} currentWeek={currentWeek} completion={completion} onSelect={(w) => go(w, Math.min(day, program.weeks[w - 1].days.length - 1))} />
      <DayTabs week={pweek} day={day} done={pweek.days.map((_, i) => done.has(refKey({ week, day: i })))} today={todayIdx} onSelect={(d) => go(week, d)} />

      {log && logDone ? (
        <DoneCard log={log} program={program} unit={unit} prs={donePRs} next={next} slug={me.slug} onUndo={undo} />
      ) : (
        <ProgressStrip progress={progress} onJump={jump} />
      )}

      {pweek.intro ? (
        <Banner tone="accent" icon="info" title={t('introTitle')}>
          {t('introBody')}
        </Banner>
      ) : null}

      <div className="tr-list">
        {pday.ex.map((e, i) => (
          <ExerciseCard
            key={i}
            index={i}
            total={pday.ex.length}
            e={e}
            stored={log?.ex[String(i)]}
            machines={machines}
            machineOptions={machineOptions}
            unit={unit}
            intro={pweek.intro}
            prev={prevs[i]}
            priorBest={priorBest}
            open={open.has(i)}
            slug={me.slug}
            actions={actions}
          />
        ))}
      </div>

      {canFinish ? (
        <Button variant="secondary" size="lg" block icon="check" className="tr-finish-cta" onClick={() => setFinishOpen(true)}>
          {t('finishTitle')}
        </Button>
      ) : null}

      <div className={cx('tr-bottom', rest && 'has-rest')} aria-hidden="true" />

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        log={toFinish}
        program={program}
        day={pday}
        week={week}
        unit={unit}
        priorBest={priorBest}
        onConfirm={finish}
      />
      <RestTimerHost />
    </div>
  )
}
