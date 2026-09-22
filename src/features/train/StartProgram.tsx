import { useState } from 'react'
import type { Member, Program } from '../../data/types'
import { dayShortName } from '../../data/programs'
import { update } from '../../data/store'
import { useT } from '../../i18n'
import { addDays, isISODate, nextMonday, todayISO } from '../../lib/dates'
import { fmtDate } from '../../lib/format'
import { Button, Card, Chip, DateField, cx, toast } from '../../ui'
import { textLang } from './logic/format'
import { M } from './messages'
import { useProgramName } from './programText'

/** Pick day 1 of the program. Used by the Train page's start card and the Home hero's sheet. */
export function StartProgramForm({ me, program, onSaved }: { me: Member; program: Program; onSaved?: () => void }) {
  const t = useT(M)
  const today = todayISO()
  const monday = nextMonday(addDays(today, 1))
  const [date, setDate] = useState(today)
  const valid = isISODate(date)
  const save = () => {
    if (!valid) return
    update('members', me.id, { programStart: date })
    toast(t('startedToast', { date: fmtDate(date, 'long') }), { tone: 'good' })
    onSaved?.()
  }
  return (
    <div className="tr-start">
      <div className="tr-start__quick">
        <Chip selected={date === today} onClick={() => setDate(today)} icon="calendar-check">
          {t('startToday')}
        </Chip>
        <Chip selected={date === monday} onClick={() => setDate(monday)} icon="calendar">
          {`${t('startMonday')} · ${fmtDate(monday)}`}
        </Chip>
      </div>
      <DateField label={t('startDate')} value={date} onChange={setDate} />
      <div>
        <p className="tr-start__body">{t('startBody')}</p>
        <ol className="tr-rhythm">
          {program.schedule.map((slot, i) => {
            const d = valid ? addDays(date, i) : null
            const pday = slot != null ? program.weeks[0]?.days[slot] : null
            return (
              <li key={i} className={cx('tr-rhythm__d', !pday && 'is-rest')}>
                <span className="tr-rhythm__wd">{d ? fmtDate(d, 'weekday') : ''}</span>
                <span className="tr-rhythm__w" lang={pday ? textLang(dayShortName(pday)) : undefined}>
                  {pday ? dayShortName(pday) : t('restWord')}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <Button block icon="play" onClick={save} disabled={!valid}>
        {t('startCta')}
      </Button>
    </div>
  )
}

/** Shown on the Train page while the program has no start date. Browsing workouts still works below it. */
export function StartProgramCard({ me, program }: { me: Member; program: Program }) {
  const t = useT(M)
  const name = useProgramName(program)
  return (
    <Card as="section" className="tr-startcard" aria-labelledby="tr-start-title">
      <p className="eyebrow" lang={textLang(name)}>
        {name}
      </p>
      <h2 className="tr-startcard__title" id="tr-start-title">
        {t('startTitle')}
      </h2>
      <StartProgramForm me={me} program={program} />
      <p className="tr-start__hint">{t('browseHint')}</p>
    </Card>
  )
}
