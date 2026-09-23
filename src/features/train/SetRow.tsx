import { memo, useRef, type KeyboardEvent } from 'react'
import type { SetLog, Unit } from '../../data/types'
import { useLang, useT, type Lang } from '../../i18n'
import { Icon, PRBadge, cx, displayDecimal, sanitizeDecimalDraft } from '../../ui'
import type { Placeholder, TickResult } from './logic/log'
import { M } from './messages'

export interface SetActions {
  field: (exercise: number, set: number, field: 'w' | 'r', value: string) => void
  /** `keyboard`: the check was pressed with Enter/Space, so focus follows to the next exercise's first input. */
  tick: (exercise: number, set: number, placeholder: Placeholder | null, keyboard?: boolean) => TickResult
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
  /** Small line under a ticked set ("e1RM 76.7 kg · +3.4 vs best"). */
  caption?: string | null
  actions: SetActions
}

const REPS = /^\d{0,3}$/

/** A stored weight (canonical "67.5"; older logs may hold a typed "67,5") as the input shows it: "67,5" in Greek. */
const shown = (w: string | undefined, lang: Lang): string => displayDecimal((w ?? '').replace(',', '.'), lang)

/** One set: number (+ PR badge or technique tag), weight, reps and the 52 px done check. */
export const SetRow = memo(function SetRow({ exercise, index, set, placeholder, unit, extra, tag, pr, caption, actions }: Props) {
  const t = useT(M)
  const lang = useLang()
  const repsRef = useRef<HTMLInputElement>(null)
  const n = index + 1

  const tick = (keyboard: boolean) => {
    const r = actions.tick(exercise, index, placeholder, keyboard)
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
      // The soft keyboard's "done" key: don't pull the keyboard back up on the next exercise.
      if (!set.ok) tick(false)
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
          value={shown(set.w, lang)}
          placeholder={shown(placeholder?.w, lang)}
          inputMode="decimal"
          enterKeyHint="next"
          autoComplete="off"
          aria-label={t('weightAria', { n, unit })}
          onKeyDown={onWeightKey}
          onChange={(e) => {
            // Stored with a dot whatever the keyboard typed (a draft like "67." stays as typed); shown with a comma in Greek.
            const v = sanitizeDecimalDraft(e.target.value, 2, false)
            if (v != null) actions.field(exercise, index, 'w', v.replace(',', '.'))
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
      <button type="button" className="tr-chk" aria-pressed={set.ok} aria-label={set.ok ? t('untickAria', { n }) : t('tickAria', { n })} onClick={(e) => tick(e.detail === 0)}>
        <Icon name="check" size={22} strokeWidth={2.4} />
      </button>
      {caption ? <p className="tr-set__e1">{caption}</p> : null}
    </div>
  )
})
