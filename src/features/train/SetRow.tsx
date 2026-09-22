import { memo, useRef, type KeyboardEvent } from 'react'
import type { SetLog, Unit } from '../../data/types'
import { useT } from '../../i18n'
import { Icon, PRBadge, cx, sanitizeDecimalDraft } from '../../ui'
import type { Placeholder, TickResult } from './logic/log'
import { M } from './messages'

export interface SetActions {
  field: (exercise: number, set: number, field: 'w' | 'r', value: string) => void
  tick: (exercise: number, set: number, placeholder: Placeholder | null) => TickResult
}

interface Props {
  exercise: number
  index: number
  set: SetLog
  placeholder: Placeholder | null
  unit: Unit
  extra: boolean
  /** Technique micro tag on the last prescribed set ("FAIL"). */
  tag: string | null
  pr: boolean
  actions: SetActions
}

const REPS = /^\d{0,3}$/

/** One set: number (+ PR badge or technique tag), weight, reps and the 52 px done check. */
export const SetRow = memo(function SetRow({ exercise, index, set, placeholder, unit, extra, tag, pr, actions }: Props) {
  const t = useT(M)
  const repsRef = useRef<HTMLInputElement>(null)
  const n = index + 1

  const tick = () => {
    const r = actions.tick(exercise, index, placeholder)
    if (r === 'need-reps') {
      const el = repsRef.current
      if (el) {
        el.focus()
        el.classList.remove('is-nudge')
        void el.offsetWidth
        el.classList.add('is-nudge')
      }
    }
  }
  const onWeightKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      repsRef.current?.focus()
    }
  }
  const onRepsKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!set.ok) tick()
      e.currentTarget.blur()
    }
  }

  return (
    <div className={cx('tr-set', set.ok && 'is-done', extra && 'is-extra')}>
      <div className="tr-set__n">
        <b className="num">{n}</b>
        {pr && set.ok ? <PRBadge pop /> : extra ? <span className="tr-set__tq">{t('extra')}</span> : tag ? <span className="tr-set__tq">{tag}</span> : null}
      </div>
      <div className="tr-fld">
        <input
          value={set.w}
          placeholder={placeholder?.w ?? ''}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          aria-label={t('weightAria', { n, unit })}
          onKeyDown={onWeightKey}
          onChange={(e) => {
            const v = sanitizeDecimalDraft(e.target.value, 2, false)
            if (v != null) actions.field(exercise, index, 'w', v)
          }}
        />
      </div>
      <div className="tr-fld">
        <input
          ref={repsRef}
          value={set.r}
          placeholder={placeholder?.r ?? ''}
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
          autoComplete="off"
          aria-label={t('repsAria', { n })}
          onKeyDown={onRepsKey}
          onAnimationEnd={(e) => e.currentTarget.classList.remove('is-nudge')}
          onChange={(e) => {
            const v = e.target.value.trim()
            if (REPS.test(v)) actions.field(exercise, index, 'r', v)
          }}
        />
      </div>
      <button type="button" className="tr-chk" aria-pressed={set.ok} aria-label={set.ok ? t('untickAria', { n }) : t('tickAria', { n })} onClick={tick}>
        <Icon name="check" size={22} strokeWidth={2.4} />
      </button>
    </div>
  )
})
