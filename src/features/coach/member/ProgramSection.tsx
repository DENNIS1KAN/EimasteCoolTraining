import { useMemo } from 'react'
import { Card, CardHeader, Chip, DateField, Select } from '../../../ui'
import { useT } from '../../../i18n'
import { useStore } from '../../../data/store'
import { addDays, diffDays, nextMonday, todayISO } from '../../../lib/dates'
import { fmtDate } from '../../../lib/format'
import { programWeekOn } from '../../../lib/stats'
import { isISODate } from '../../../lib/dates'
import { PatternStrip } from '../components/PatternStrip'
import { fmtDayDate } from '../lib/fmt'
import type { MemberDraft } from '../lib/memberForm'
import { programEnd, sortPrograms, weekdayIndex } from '../lib/programs'
import { splitProgramName } from '../../train/programText'
import { M as TRAIN } from '../../train/messages'
import { M } from '../messages'

export interface ProgramSectionProps {
  draft: MemberDraft
  set: (patch: Partial<MemberDraft>) => void
  error: string | null
}

/** Program + start date, with the calendar spelled out ("Week 1 starts on Mon 8 Sep") and the weekly pattern. */
export function ProgramSection({ draft, set, error }: ProgramSectionProps) {
  const t = useT(M)
  const tt = useT(TRAIN)
  // Same wording as useProgramName ("BTS · 12 εβδομάδες"), for every option of the list.
  const nameOf = (p: { name: string }) => {
    const s = splitProgramName(p.name)
    return s ? `${s.base} · ${tt('weeksN', { n: s.weeks })}` : p.name
  }
  const programsById = useStore((s) => s.programs)
  const programs = useMemo(() => sortPrograms(Object.values(programsById)), [programsById])
  const program = draft.programId ? programsById[draft.programId] : undefined
  const today = todayISO()
  const upcomingMonday = nextMonday(addDays(today, 1))
  const start = isISODate(draft.programStart) ? draft.programStart : null

  let status: string | null = null
  if (program && start) {
    const end = programEnd(program, start)
    if (today < start) {
      const n = diffDays(today, start)
      status = n === 1 ? t('startsTomorrow') : t('startsIn', { n })
    } else if (today > end) status = t('finishedOn', { date: fmtDayDate(end) })
    else status = t('nowInWeek', { n: programWeekOn(program, start, today), total: program.weeks.length })
  }

  return (
    <Card as="section" aria-labelledby="member-program-title" className="coach-stack">
      <CardHeader title={<span id="member-program-title">{t('program')}</span>} subtitle={status} />
      <Select
        label={t('program')}
        options={[{ value: '', label: t('noneProgram') }, ...programs.map((p) => ({ value: p.id, label: nameOf(p) }))]}
        value={draft.programId}
        onChange={(programId) => set({ programId })}
        icon="list"
      />
      {program ? (
        <>
          <div className="stack-sm">
            <DateField
              label={t('startDate')}
              value={draft.programStart}
              onChange={(programStart) => set({ programStart })}
              error={error}
              hint={start ? undefined : t('noStartHelp')}
            />
            <div className="start-chips">
              <Chip
                icon="calendar-check"
                selected={draft.programStart === upcomingMonday}
                onClick={() => set({ programStart: upcomingMonday })}
              >
                {t('startNextMonday')} · {fmtDate(upcomingMonday, 'dayMonth')}
              </Chip>
              {draft.programStart ? (
                <Chip icon="x" onClick={() => set({ programStart: '' })}>
                  {t('clearStart')}
                </Chip>
              ) : null}
            </div>
          </div>
          {start ? (
            <div className="start-help">
              <p>
                <strong>{t('week1Starts', { date: fmtDayDate(start) })}</strong>
                <br />
                {t('lastWeekEnds', { n: program.weeks.length, date: fmtDayDate(programEnd(program, start)) })}
              </p>
              {weekdayIndex(start) !== 0 ? (
                <p className="start-help__warn">
                  {t('notMonday', { from: fmtDate(start, 'weekday'), to: fmtDate(addDays(start, 6), 'weekday') })}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="stack-sm">
            <p className="micro muted">{t('weeklyPattern')}</p>
            <PatternStrip program={program} start={start} label={t('weeklyPattern')} />
          </div>
        </>
      ) : null}
    </Card>
  )
}
