import type { Program, Unit, WorkoutLog } from '../../data/types'
import { dayShortName } from '../../data/programs'
import { useT } from '../../i18n'
import { isoFromMs } from '../../lib/dates'
import { fmtDate, fmtDuration, fmtVolume } from '../../lib/format'
import { sessionSummary, type WorkoutRef } from '../../lib/stats'
import { Button, ButtonLink, Card, CardLink, Icon } from '../../ui'
import { durationParts, fmtTime } from './logic/format'
import { setTally, type SetTally } from './logic/log'
import { M } from './messages'

export const FEEL_KEYS = ['feel1', 'feel2', 'feel3', 'feel4', 'feel5'] as const

interface Props {
  log: WorkoutLog
  program: Program
  unit: Unit
  prs: number
  next: WorkoutRef | null
  slug: string
  onUndo: () => void
}

/** The completion state at the top of a finished workout: summary, feel, note, next workout, undo. */
export function DoneCard({ log, program, unit, prs, next, slug, onUndo }: Props) {
  const t = useT(M)
  const doneAt = log.doneAt ?? log.updatedAt
  const nextDay = next ? program.weeks[next.week - 1]?.days[next.day] : null
  const feelKey = log.feel ? (FEEL_KEYS[Math.round(log.feel) - 1] ?? null) : null
  return (
    <Card as="section" className="tr-done" aria-labelledby="tr-done-title">
      <div className="tr-done__head">
        <span className="tr-done__icon" aria-hidden="true">
          <Icon name="check" size={24} strokeWidth={2.6} />
        </span>
        <div>
          <h2 className="tr-done__title" id="tr-done-title" tabIndex={-1}>
            {t('doneTitle')}
          </h2>
          <p className="tr-done__sub">{t('doneAt', { date: fmtDate(isoFromMs(doneAt), 'long'), time: fmtTime(doneAt) })}</p>
        </div>
      </div>
      <SessionStats log={log} program={program} unit={unit} prs={prs} />
      {feelKey || log.note ? (
        <p className="tr-done__note">
          {feelKey ? <b>{t(feelKey)}</b> : null}
          {feelKey && log.note ? ' · ' : null}
          {log.note ? <span>“{log.note}”</span> : null}
        </p>
      ) : null}
      <div className="tr-done__actions">
        {next && nextDay ? (
          <ButtonLink to={`/train/${next.week}/${next.day}`} block iconRight="arrow-right">
            {t('nextUp', { name: t('nextUpWeek', { name: dayShortName(nextDay), week: next.week }) })}
          </ButtonLink>
        ) : (
          <p className="tr-done__final">
            <Icon name="trophy" size={18} /> {t('programDone')}
          </p>
        )}
        <div className="tr-done__row">
          <Button variant="ghost" size="sm" icon="refresh" onClick={onUndo}>
            {t('markNotDone')}
          </Button>
          <CardLink to={`/member/${slug}/workout/${log.week}/${log.day}`}>{t('viewShared')}</CardLink>
        </div>
      </div>
    </Card>
  )
}

/** The four tiles of a finished (or in-progress) workout: duration, sets, volume, new PRs. Also on the squad view. */
export function SessionStats({ log, program, unit, prs }: { log: WorkoutLog; program: Program; unit: Unit; prs: number }) {
  const t = useT(M)
  const s = sessionSummary(log, program)
  return (
    <dl className="tr-done__stats">
      <div>
        <dt>{t('duration')}</dt>
        <dd className="num">
          <DurationValue ms={s.durationMs} />
        </dd>
      </div>
      <div>
        <dt>{t('sets')}</dt>
        <dd className="num">
          <SetsValue tally={setTally(log, program.weeks[log.week - 1]?.days[log.day])} />
        </dd>
      </div>
      <div>
        <dt>{t('volume')}</dt>
        <dd className="num">{fmtVolume(s.volumeKg, unit)}</dd>
      </div>
      <div>
        <dt>{t('newPrs')}</dt>
        <dd className="num">{prs}</dd>
      </div>
    </dl>
  )
}

/** "48′" / "1h 10′" (fits a quarter-width tile); screen readers get "1 h 10 min". */
export function DurationValue({ ms }: { ms: number | null }) {
  if (!ms) return <>—</>
  const d = Math.max(60_000, ms)
  const { h, m } = durationParts(d)
  return (
    <>
      <span className="visually-hidden">{fmtDuration(d)}</span>
      <span aria-hidden="true">
        {h ? (
          <>
            {h}
            <small>h</small>
          </>
        ) : null}
        {h && m ? ' ' : null}
        {m || !h ? `${m}′` : null}
      </span>
    </>
  )
}

/** "14/14", extra sets apart: "14/14 +1" (prescribed sets are the denominator everywhere). */
export function SetsValue({ tally }: { tally: SetTally }) {
  const t = useT(M)
  return (
    <>
      {tally.done}
      <small>/{tally.prescribed}</small>
      {tally.extra ? (
        <small className="tr-extra-n" title={t('extraSets', { n: tally.extra })}>
          {' '}+{tally.extra}
        </small>
      ) : null}
    </>
  )
}
