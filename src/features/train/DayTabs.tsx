import type { ProgramWeek } from '../../data/types'
import { dayShortName } from '../../data/programs'
import { useT } from '../../i18n'
import { Icon, Segmented } from '../../ui'
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

/** Upper / Lower / Pull / Push / Legs with a sub-label: ✓ when done, the focus (STR/HYP), TODAY for the scheduled one. */
export function DayTabs({ week, day, done, today, onSelect }: Props) {
  const t = useT(M)
  const options = week.days.map((d, i) => {
    const focus = focusOf(d)
    const f = focus === 'str' ? t('str') : focus === 'hyp' ? t('hyp') : null
    const sub = (
      <>
        {done[i] ? <Icon name="check" size={11} strokeWidth={2.8} className="tr-days__ok" /> : null}
        {i === today && !done[i] ? t('todayTag') : f}
      </>
    )
    return { value: i, label: <span lang="en">{dayShortName(d)}</span>, sub, ariaLabel: `${dayShortName(d)}${f ? ` · ${f}` : ''}${done[i] ? ' ✓' : ''}` }
  })
  return <Segmented options={options} value={day} onChange={onSelect} size="lg" block ariaLabel={t('workoutDay')} className="tr-days" />
}
