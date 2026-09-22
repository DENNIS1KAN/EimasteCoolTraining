import { memo, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ExerciseLog, ProgramExercise, SetLog, Unit } from '../../data/types'
import { exerciseName, exerciseVideo, workingSets } from '../../data/programs'
import { useT, type Vars } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { e1rm, isPRSet, setKg, setReps } from '../../lib/stats'
import { kgToUnit, parseNum } from '../../lib/units'
import { Card, Chip, Icon, cx } from '../../ui'
import { ProgressRing } from '../../ui/charts'
import { ExerciseExtras, type ExtrasActions } from './ExerciseExtras'
import { SetList } from './SetList'
import { SetRow, type SetActions } from './SetRow'
import { fmtRange, fmtRestShort, fmtRpe, fmtTypedWeight, setSeparator, swapCount, textLang } from './logic/format'
import { exerciseFrom, type Machines } from './logic/log'
import { placeholdersFor, type PrevPerformance } from './logic/previous'
import { parseRepRange, suggestNext, type Suggestion } from './logic/progression'
import { lastSetTechnique, type Technique } from './logic/techniques'
import { M } from './messages'
import { useTechniqueLabel, useTechniqueText } from './techniqueText'

export interface ExerciseActions extends SetActions, ExtrasActions {
  addSet: (exercise: number) => void
  removeSet: (exercise: number) => void
  aim: (exercise: number, weight: string) => void
  toggle: (exercise: number) => void
}

interface Props {
  index: number
  total: number
  e: ProgramExercise
  stored: ExerciseLog | undefined
  machines: Machines
  machineOptions: string[]
  unit: Unit
  intro: boolean
  prev: PrevPerformance | null
  /** Best e1RM (kg) per performed exercise name before this workout. */
  priorBest: Map<string, number>
  open: boolean
  /** Viewer's slug, for the lift-history link. */
  slug: string
  actions: ExerciseActions
}

/** A logged exercise: header, spec strip, last time + aim, set rows and the extras expander. Collapses to a row. */
export const ExerciseCard = memo(function ExerciseCard(p: Props) {
  const x = useMemo(() => exerciseFrom(p.stored, p.e, p.machines), [p.stored, p.e, p.machines])
  return p.open ? <OpenExercise {...p} x={x} /> : <CollapsedExercise {...p} x={x} />
})

function OpenExercise(p: Props & { x: ExerciseLog }) {
  const { index, total, e, x, unit, intro, prev, priorBest, actions } = p
  const t = useT(M)
  const [showTech, setShowTech] = useState(false)
  const name = exerciseName(e, x.v)
  const tech = lastSetTechnique(e, intro)
  const techText = useTechniqueText(tech)
  const techLabel = useTechniqueLabel(tech)
  const prescribed = workingSets(e)
  const done = x.sets.filter((s) => s.ok).length
  const suggestion = useMemo(() => (prev ? suggestNext(prev.sets, e.r, unit) : null), [prev, e.r, unit])
  const prior = priorBest.get(name)
  const video = exerciseVideo(e, x.v)
  const tagText = tech ? techTag(tech, t) : null
  const firstW = parseNum(x.sets[0]?.w)
  const workingWeight = firstW && firstW > 0 ? firstW : (suggestion?.weight ?? prev?.sets.find((s) => s.weight)?.weight ?? null)
  const swaps = swapCount(e)
  const placeholders = useMemo(() => placeholdersFor(prev, x.sets), [prev, x.sets])
  /** Under a ticked set: "e1RM 76.7 kg · +3.4 vs best" (the best before this workout), in the member's unit. */
  const e1Caption = (s: SetLog): string | null => {
    const kg = setKg(s, unit)
    const reps = setReps(s)
    if (!s.ok || !kg || !reps) return null
    const est = e1rm(kg, reps)
    const v = `${fmtNum(kgToUnit(est, unit), 1)} ${unit}`
    if (!prior) return t('e1rmOnly', { v })
    const diff = Math.round(kgToUnit(est - prior, unit) * 10) / 10
    const d = fmtNum(Math.abs(diff), 1)
    return t(diff > 0 ? 'e1rmAbove' : diff < 0 ? 'e1rmBelow' : 'e1rmTie', { v, d })
  }

  return (
    <Card as="article" className="tr-ex" id={`ex-${index}`} aria-labelledby={`ex-${index}-name`} tabIndex={-1}>
      <div className="tr-ex__head">
        <div className="tr-ex__title">
          <p className="tr-ex__n">{t('exerciseN', { n: index + 1, total })}</p>
          <h2 className="tr-ex__name" id={`ex-${index}-name`}>
            <Link to={`/lift/${p.slug}/${encodeURIComponent(name)}`} title={t('history', { name })} lang={textLang(name)}>
              {name}
            </Link>
          </h2>
        </div>
        {video ? (
          <a className="ui-iconbtn ui-iconbtn--soft" href={video} target="_blank" rel="noreferrer" aria-label={`${t('video')}: ${name}`}>
            <Icon name="video" size={20} />
          </a>
        ) : null}
        <button type="button" className="ui-iconbtn ui-iconbtn--ghost tr-ex__fold" aria-expanded="true" aria-label={name} onClick={() => actions.toggle(index)}>
          <Icon name="chevron-up" size={20} />
        </button>
      </div>

      {x.m || tech || x.v ? (
        <div className="tr-ex__tags">
          {x.m ? <Chip icon="machine">{x.m}</Chip> : null}
          {x.v ? <Chip icon="swap">{t('swapped')}</Chip> : null}
          {tech ? (
            <Chip icon="flame" selected={showTech} onClick={() => setShowTech((v) => !v)}>
              {t('lastSet', { t: techLabel ?? tech.label })}
            </Chip>
          ) : null}
        </div>
      ) : null}
      {tech && techText && showTech ? (
        <p className="tr-ex__tech" role="note">
          {techText}
        </p>
      ) : null}

      <SpecStrip e={e} />

      {prev?.sets.length ? <LastTime prev={prev} unit={unit} range={e.r} suggestion={suggestion} onAim={(w) => actions.aim(index, w)} /> : null}

      <SetList unit={unit}>
        {x.sets.map((s, j) => (
          <SetRow
            key={j}
            exercise={index}
            index={j}
            set={s}
            placeholder={placeholders[j]}
            unit={unit}
            extra={j >= prescribed}
            tag={j === prescribed - 1 ? tagText : null}
            pr={s.ok && isPRSet(s, unit, prior)}
            caption={e1Caption(s)}
            actions={actions}
          />
        ))}
      </SetList>

      <div className="tr-ex__more">
        <button type="button" className="tr-textbtn" onClick={() => actions.addSet(index)}>
          <Icon name="plus" size={16} />
          {t('addSet')}
        </button>
        {x.sets.length > prescribed ? (
          <button type="button" className="tr-textbtn" onClick={() => actions.removeSet(index)}>
            <Icon name="minus" size={16} />
            {t('removeSet')}
          </button>
        ) : null}
        <span className="tr-ex__count num" aria-hidden="true">
          {done}/{x.sets.length}
        </span>
      </div>

      <details className="tr-xpand">
        <summary>
          <Icon name="list" size={18} />
          <span className="tr-xpand__t">{t('extras')}</span>
          {swaps || e.note ? (
            <span className="tr-xpand__s">
              {swaps ? (
                <span title={t('swapsCount', { n: swaps })}>
                  <Icon name="swap" size={14} />
                  <span className="num">{swaps}</span>
                  <span className="visually-hidden">{t('swapsCount', { n: swaps })}</span>
                </span>
              ) : null}
              {e.note ? (
                <span title={t('noteCount')}>
                  <Icon name="note" size={14} />
                  <span className="num">1</span>
                  <span className="visually-hidden">{t('noteCount')}</span>
                </span>
              ) : null}
            </span>
          ) : null}
          <Icon name="chevron-down" size={18} className="tr-xpand__chev" />
        </summary>
        <ExerciseExtras
          index={index}
          e={e}
          v={x.v}
          machine={x.m}
          machineOptions={p.machineOptions}
          unit={unit}
          workingWeight={workingWeight}
          tech={tech}
          techText={techText}
          actions={actions}
        />
      </details>
    </Card>
  )
}

type T = (k: keyof typeof M.en, vars?: Vars) => string

function techTag(tech: Technique, t: T): string | null {
  switch (tech.key) {
    case 'failure':
      return t('tagFailure')
    case 'myo':
      return t('tagMyo')
    case 'llp':
      return t('tagLlp')
    case 'stretch':
      return t('tagStretch')
    default:
      return null
  }
}

export function SpecStrip({ e }: { e: ProgramExercise }) {
  const t = useT(M)
  const early = fmtRpe(e.e)
  const last = fmtRpe(e.l)
  const rpe: ReactNode =
    early && last ? (
      <>
        <RpeText s={early} /> <em>/</em> <RpeText s={last} />
      </>
    ) : (
      <RpeText s={early ?? last ?? '—'} />
    )
  return (
    <dl className="tr-spec" aria-label={t('rpeHint', { early: early ?? '—', last: last ?? '—' })}>
      <div>
        <dt>{t('specSets')}</dt>
        <dd className="num">{e.s}</dd>
      </div>
      <div>
        <dt>{t('specReps')}</dt>
        <dd className="num">{fmtRange(e.r)}</dd>
      </div>
      <div>
        <dt>{t('specRpe')}</dt>
        <dd className="num">{rpe}</dd>
      </div>
      <div>
        <dt>{t('specRest')}</dt>
        <dd className="num">{fmtRestShort(e.rest)}</dd>
      </div>
    </dl>
  )
}

/** "~8–9": the tilde is set in the UI face (the condensed one reads like a dash). */
function RpeText({ s }: { s: string }) {
  return s.startsWith('~') ? (
    <>
      <i className="approx">~</i>
      {s.slice(1)}
    </>
  ) : (
    <>{s}</>
  )
}

/** "55 × 10, 55 × 9" with the × in the UI face. */
export function SetsText({ sets }: { sets: { w: string; r: string }[] }) {
  return (
    <>
      {sets.map((s, i) => (
        <span key={i} className="nowrap">
          {i > 0 ? setSeparator() : null}
          {s.w ? (
            <>
              {fmtTypedWeight(s.w)}
              <i className="mul">×</i>
            </>
          ) : null}
          {s.r}
        </span>
      ))}
    </>
  )
}

function LastTime(p: { prev: PrevPerformance; unit: Unit; range: string; suggestion: Suggestion | null; onAim: (w: string) => void }) {
  const { prev, unit, suggestion, onAim } = p
  const t = useT(M)
  const top = parseRepRange(p.range)?.[1]
  const aimText = suggestion ? aimLabel(suggestion, unit, t) : null
  const hint = suggestion
    ? suggestion.kind === 'load'
      ? t('aimHintLoad', { step: `${fmtNum(suggestion.step, 1)} ${unit}`, reps: suggestion.reps })
      : t('aimHintReps', { top: top ?? suggestion.reps })
    : undefined
  return (
    <div className="tr-last">
      <Icon name="history" size={15} />
      <span className="visually-hidden">{t('lastTimeAria')}</span>
      <span className="tr-last__wk">{t('lastTimeWeek', { n: prev.week })}</span>
      <b className="num tr-last__sets">
        <SetsText sets={prev.sets} />
      </b>
      {aimText && suggestion ? (
        <Chip
          tone="accent"
          size="sm"
          icon="target"
          title={hint}
          aria-label={`${aimText}. ${hint ?? ''}`}
          className="tr-last__aim"
          onClick={suggestion.weight != null ? () => onAim(String(suggestion.weight)) : undefined}
        >
          {aimText}
        </Chip>
      ) : null}
    </div>
  )
}

function aimLabel(s: Suggestion, unit: Unit, t: T): string {
  if (s.weight == null) return s.kind === 'load' ? t('aimAddLoad') : t('aimRepsOnly')
  const w = `${fmtNum(s.weight, 2)} ${unit}`
  return s.kind === 'load' ? t('aim', { w }) : t('aimReps', { w })
}

function CollapsedExercise(p: Props & { x: ExerciseLog }) {
  const t = useT(M)
  const { e, index, total, x } = p
  const name = exerciseName(e, x.v)
  const tech = lastSetTechnique(e, p.intro)
  const techLabel = useTechniqueLabel(tech)
  const rows = x.sets.length
  const doneSets = x.sets.filter((s) => s.ok)
  const done = doneSets.length
  const complete = done >= workingSets(e)
  const sub = doneSets.length ? (
    <SetsText sets={doneSets} />
  ) : (
    <>
      {e.s}
      <i className="mul">×</i>
      {fmtRange(e.r)} · RPE {fmtRpe(e.l) ?? fmtRpe(e.e) ?? '—'}
      {techLabel ? ` · ${techLabel}` : ''}
    </>
  )
  return (
    <Card as="article" className={cx('tr-ex2', complete && 'is-complete')} id={`ex-${index}`} padding="none">
      <button
        type="button"
        className="tr-ex2__btn"
        aria-expanded="false"
        aria-label={`${t('exerciseN', { n: index + 1, total })}: ${name}, ${t('setsProgress', { done, total: rows })}`}
        onClick={() => p.actions.toggle(index)}
      >
        <ProgressRing value={rows ? done / rows : 0} size={40} stroke={4} color="var(--accent-strong)" trackColor="var(--surface-3)" ariaLabel={t('setsProgress', { done, total: rows })}>
          {complete ? <Icon name="check" size={18} strokeWidth={2.6} /> : <span className="num tr-ex2__frac">{`${done}/${rows}`}</span>}
        </ProgressRing>
        <span className="tr-ex2__text">
          <span className="tr-ex2__n">{t('exerciseN', { n: index + 1, total })}</span>
          <span className="tr-ex2__t" lang={textLang(name)}>
            {name}
          </span>
          <span className={cx('tr-ex2__s', doneSets.length && 'num')}>{sub}</span>
        </span>
        <Icon name="chevron-down" size={18} className="tr-ex2__chev" />
      </button>
    </Card>
  )
}
