import { useId } from 'react'
import type { ProgramExercise, Unit } from '../../data/types'
import { exerciseName, exerciseVideo, warmupSetCount } from '../../data/programs'
import { useT } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { Chip, Icon, TextField, cx } from '../../ui'
import { fmtRange, textLang } from './logic/format'
import type { Technique } from './logic/techniques'
import { warmupRamp } from './logic/warmup'
import { M } from './messages'
import { useTechniqueLabel } from './techniqueText'

export interface ExtrasActions {
  variant: (exercise: number, v: 0 | 1 | 2) => void
  machine: (exercise: number, value: string) => void
}

interface Props {
  index: number
  e: ProgramExercise
  v: 0 | 1 | 2
  machine: string
  machineOptions: string[]
  unit: Unit
  /** Weight the ramp builds up to (null = unknown yet). */
  workingWeight: number | null
  tech: Technique | null
  techText: string | null
  actions: ExtrasActions
}

/** Body of the "Warm-up, swaps & notes" expander. */
export function ExerciseExtras({ index, e, v, machine, machineOptions, unit, workingWeight, tech, techText, actions }: Props) {
  const t = useT(M)
  const ids = useId()
  const techLabel = useTechniqueLabel(tech)
  const ramp = warmupRamp(workingWeight, warmupSetCount(e), unit)
  const variants = ([0, 1, 2] as const).filter((k) => k === 0 || (k === 1 ? !!e.s1 : !!e.s2))
  const name = exerciseName(e, v)
  const quick = machineOptions.filter((m) => m !== machine).slice(0, 4)

  return (
    <div className="tr-xp">
      {tech && techText ? (
        <section className="tr-xp__sec">
          <h3 className="micro">{t('technique')}</h3>
          <p className="tr-xp__p">
            <b>{techLabel}</b> · {techText}
          </p>
        </section>
      ) : null}

      <section className="tr-xp__sec">
        <h3 className="micro">
          {t('warmup')} <span className="tr-xp__muted">· {e.w}</span>
        </h3>
        {workingWeight == null ? (
          <p className="tr-xp__p tr-xp__muted">{t('warmupNoWeight')}</p>
        ) : (
          <>
            <ol className="tr-ramp">
              {ramp.map((s, i) => (
                <li key={i}>
                  <span className="tr-ramp__i num">{i + 1}</span>
                  <span className="tr-ramp__v num">
                    {s.weight != null ? fmtNum(s.weight, 2) : '—'}
                    <small>{unit}</small>
                    <i className="mul">×</i>
                    {fmtRange(s.reps)}
                  </span>
                  <span className="tr-ramp__pct">{Math.round(s.pct * 100)}%</span>
                </li>
              ))}
            </ol>
            <p className="tr-xp__hint">{t('warmupFor', { w: `${fmtNum(workingWeight, 2)} ${unit}` })}</p>
          </>
        )}
      </section>

      {variants.length > 1 ? (
        <section className="tr-xp__sec">
          <h3 className="micro" id={`${ids}-swap`}>
            {t('swap')}
          </h3>
          <div className="tr-swaps" role="radiogroup" aria-labelledby={`${ids}-swap`}>
            {variants.map((k) => {
              const vid = exerciseVideo(e, k)
              const on = k === v
              return (
                <div key={k} className={cx('tr-swap', on && 'is-on')}>
                  <button type="button" role="radio" aria-checked={on} className="tr-swap__pick" onClick={() => actions.variant(index, k)}>
                    <span className="tr-swap__dot" aria-hidden="true">
                      {on ? <Icon name="check" size={14} strokeWidth={2.6} /> : null}
                    </span>
                    <span className="tr-swap__text">
                      <span className="tr-swap__name">{exerciseName(e, k)}</span>
                      <span className="tr-swap__sub">{k === 0 ? t('original') : t('alternative', { n: k })}</span>
                    </span>
                  </button>
                  {vid ? (
                    <a className="tr-swap__vid" href={vid} target="_blank" rel="noreferrer" aria-label={`${t('video')}: ${exerciseName(e, k)}`}>
                      <Icon name="video" size={18} />
                    </a>
                  ) : null}
                </div>
              )
            })}
          </div>
          <p className="tr-xp__hint">{t('swapHint')}</p>
        </section>
      ) : null}

      <section className="tr-xp__sec">
        <TextField
          label={t('machine')}
          icon="machine"
          value={machine}
          placeholder={t('machinePlaceholder')}
          autoComplete="off"
          enterKeyHint="done"
          onChange={(ev) => actions.machine(index, ev.target.value)}
          hint={machine ? t('machineHint', { name }) : undefined}
        />
        {quick.length ? (
          <div className="tr-xp__chips">
            {quick.map((m) => (
              <Chip key={m} size="sm" icon="machine" onClick={() => actions.machine(index, m)}>
                {m}
              </Chip>
            ))}
          </div>
        ) : null}
      </section>

      {e.note ? (
        <section className="tr-xp__sec">
          <h3 className="micro">{t('coachNote')}</h3>
          <p className="tr-xp__p" lang={textLang(e.note)}>
            {e.note}
          </p>
        </section>
      ) : null}
    </div>
  )
}
