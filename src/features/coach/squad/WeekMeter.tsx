import { cx } from '../../../ui'

export interface WeekMeterProps {
  done: number
  target: number
  /** Scheduled before today: unfilled ones among these are missed. */
  due: number
  label: string
}

/** One segment per scheduled workout this week: done (accent), missed so far (warn), still to come (track). */
export function WeekMeter({ done, target, due, label }: WeekMeterProps) {
  const n = Math.max(target, done, 1)
  return (
    <span className="week-meter" role="img" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={cx('week-meter__seg', i < done ? 'is-done' : i < due ? 'is-missed' : 'is-open')} />
      ))}
    </span>
  )
}
