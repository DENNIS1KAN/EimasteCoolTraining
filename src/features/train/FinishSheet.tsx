import { useEffect, useMemo, useState } from 'react'
import type { Program, ProgramDay, Unit, WorkoutLog } from '../../data/types'
import { dayShortName } from '../../data/programs'
import { useT } from '../../i18n'
import { todayISO } from '../../lib/dates'
import { fmtNum, fmtVolume } from '../../lib/format'
import { sessionSummary } from '../../lib/stats'
import { kgToUnit } from '../../lib/units'
import { Banner, Button, DateField, PRBadge, Sheet, TextArea, cx } from '../../ui'
import { DurationValue, SetsValue } from './DoneCard'
import { textLang } from './logic/format'
import { doneAtFor, openSetsWithReps, setTally } from './logic/log'
import { logPRs } from './logic/prs'
import { M } from './messages'

export interface FinishInput {
  doneAt: number
  feel: number | null
  note: string
}

interface Props {
  open: boolean
  onClose: () => void
  log: WorkoutLog | null
  program: Program
  day: ProgramDay
  week: number
  unit: Unit
  priorBest: Map<string, number>
  onConfirm: (p: FinishInput) => void
}

const FEELS = [1, 2, 3, 4, 5] as const

/** Summary (duration, sets, volume, exercises, PRs), "How did it feel?", note and date, then finish. */
export function FinishSheet({ open, onClose, log, program, day, week, unit, priorBest, onConfirm }: Props) {
  const t = useT(M)
  const [date, setDate] = useState(todayISO())
  const [feel, setFeel] = useState<number | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setDate(todayISO())
    setFeel(log?.feel ?? null)
    setNote(log?.note ?? '')
    // Only when the sheet opens: typing must not be reset by live log updates.
  }, [open])

  const now = Date.now()
  const preview = useMemo(() => {
    if (!log) return null
    const doneAt = doneAtFor(date, log, now)
    const done = { ...log, done: true, doneAt }
    return { doneAt, summary: sessionSummary(done, program), tally: setTally(done, day), prs: logPRs(done, program, priorBest) }
    // `now` is intentionally left out: the preview is taken when the inputs change.
  }, [log, date, program, day, priorBest])

  const s = preview?.summary
  const open_ = openSetsWithReps(log)
  const confirm = () => onConfirm({ doneAt: log ? doneAtFor(date, log, Date.now()) : Date.now(), feel, note: note.trim() })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('finishTitle')}
      subtitle={t('finishSub', { day: dayShortName(day), week })}
      footer={
        <Button block size="lg" icon="check" onClick={confirm}>
          {t('finishTitle')}
        </Button>
      }
    >
      <div className="tr-finish">
        <dl className="tr-finish__stats">
          <div>
            <dt>{t('duration')}</dt>
            <dd className="num">
              <DurationValue ms={s?.durationMs ?? null} />
            </dd>
          </div>
          <div>
            <dt>{t('sets')}</dt>
            <dd className="num">
              {/* Without a log yet, still out of the day's prescribed sets (never "0 / 0"). */}
              <SetsValue tally={preview?.tally ?? setTally(null, day)} />
            </dd>
          </div>
          <div>
            <dt>{t('volume')}</dt>
            <dd className="num">{fmtVolume(s?.volumeKg ?? 0, unit)}</dd>
          </div>
          <div>
            <dt>{t('exercises')}</dt>
            <dd className="num">
              {s?.exercises ?? 0}
              <small>/{day.ex.length}</small>
            </dd>
          </div>
        </dl>

        {preview?.prs.length ? (
          <section className="tr-finish__prs" aria-label={t('newPrs')}>
            <p className="micro">{t('newPrs')}</p>
            <ul>
              {preview.prs.map((pr) => (
                <li key={pr.exercise}>
                  <PRBadge />
                  <span className="tr-finish__pr-name" lang={textLang(pr.exercise)}>
                    {pr.exercise}
                  </span>
                  <span className="num tr-finish__pr-v">
                    {fmtNum(kgToUnit(pr.kg, unit), 1)}
                    <i className="mul">×</i>
                    {pr.reps}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!s?.setsDone ? (
          <Banner tone="info">{t('nothingLogged')}</Banner>
        ) : open_ > 0 ? (
          <Banner tone="info">{t('openSets', { n: open_ })}</Banner>
        ) : null}

        <fieldset className="tr-feel">
          <legend className="tr-feel__q">{t('feelQ')}</legend>
          <div className="tr-feel__row" role="radiogroup" aria-label={t('feelQ')}>
            {FEELS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={feel === n}
                className={cx('tr-feel__opt', feel === n && 'is-on')}
                onClick={() => setFeel(feel === n ? null : n)}
              >
                <b className="num">{n}</b>
                <span>{t(`feel${n}`)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <TextArea label={t('note')} placeholder={t('notePh')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        <DateField label={t('date')} value={date} onChange={(v) => v && setDate(v)} max={todayISO()} />
      </div>
    </Sheet>
  )
}
