import { useT } from '../../i18n'
import { cx } from '../../ui'
import type { DayProgress } from './logic/log'
import { M } from './messages'

interface Props {
  progress: DayProgress
  onJump: (exercise: number) => void
}

/** "EXERCISE 2 OF 7 ▬▬▭▭ 4 / 18 SETS" (+N for extra sets): one segment per exercise; tap a segment to jump to it. */
export function ProgressStrip({ progress, onJump }: Props) {
  const t = useT(M)
  const n = progress.exercises.length
  const cur = progress.current < 0 ? n - 1 : progress.current
  return (
    <div className="tr-prog" role="group" aria-label={t('progressAria', { n: cur + 1, total: n, done: progress.setsDone, sets: progress.setsTotal })}>
      <span className="tr-prog__l">{t('exerciseN', { n: cur + 1, total: n })}</span>
      <span className="tr-prog__segs">
        {progress.exercises.map((x, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={cx('tr-prog__seg', x.complete && 'is-done', !x.complete && x.done > 0 && 'is-part', i === progress.current && 'is-cur')}
            style={{ ['--p' as string]: String(x.total ? Math.min(1, x.done / x.prescribed) : 0) }}
            onClick={() => onJump(i)}
          />
        ))}
      </span>
      <span className="tr-prog__r num">
        {progress.setsExtra
          ? t('setsProgressExtra', { done: progress.setsDone, total: progress.setsTotal, extra: progress.setsExtra })
          : t('setsProgress', { done: progress.setsDone, total: progress.setsTotal })}
      </span>
    </div>
  )
}
