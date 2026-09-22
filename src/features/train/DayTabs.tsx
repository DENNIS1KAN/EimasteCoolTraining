import type { ProgramWeek } from '../../data/types'
import { dayShortName } from '../../data/programs'
import { useT } from '../../i18n'
import { Icon, Segmented } from '../../ui'
import { textLang } from './logic/format'
import { focusOf } from './logic/program'
import { M } from './messages'

interface Props {
  week: ProgramWeek
  day: number
  /** Which days of this week are done. */
  done: boolean[]
  /** Day index scheduled for today in this week, or -1. */
  today: number
  onSelect: (day: number) => void
}

/** Upper / Lower / Pull / Push / Legs with a sub-label: ✓ when done, the focus (STR/HYPER), TODAY for the scheduled one. */
export function DayTabs({ week, day, done, today, onSelect }: Props) {
  const t = useT(M)
  const options = week.days.map((d, i) => {
    const name = dayShortName(d)
    const focus = focusOf(d)
    const f = focus === 'str' ? t('str') : focus === 'hyp' ? t('hyp') : null
    const isToday = i === today && !done[i]
    const sub = (
      <>
        {done[i] ? <Icon name="check" size={11} strokeWidth={2.8} className="tr-days__ok" /> : null}
        {isToday ? t('todayTag') : f}
      </>
    )
    // Spoken as words ("Upper, strength, done"), not as abbreviations and a check mark.
    const spoken = [name, isToday ? t('todayTag') : null, focus === 'str' ? t('strFull') : focus === 'hyp' ? t('hypFull') : null, done[i] ? t('doneWord') : null]
    return {
      value: i,
      label: <span lang={textLang(name)}>{name}</span>,
      sub,
      ariaLabel: spoken.filter(Boolean).join(', '),
    }
  })
  return <Segmented options={options} value={day} onChange={onSelect} size="lg" block ariaLabel={t('workoutDay')} className="tr-days" />
}
