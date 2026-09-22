import type { ProgramExercise, Unit } from '../../data/types'
import { useT } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { kgToUnit } from '../../lib/units'
import { Card, Chip, PRBadge, cx } from '../../ui'
import { Link } from 'react-router'
import { SpecStrip } from './ExerciseCard'
import type { ViewExercise } from './logic/view'
import { lastSetTechnique } from './logic/techniques'
import { LIFT, M } from './messages'
import { useTechniqueText } from './techniqueText'

interface Props {
  x: ViewExercise
  e: ProgramExercise
  total: number
  intro: boolean
  unit: Unit
  slug: string
}

/** A logged exercise without inputs: same card language as the logger, sets as display numerals. */
export function ReadOnlyExercise({ x, e, total, intro, unit, slug }: Props) {
  const t = useT(M)
  const l = useT(LIFT)
  const tech = lastSetTechnique(e, intro)
  const techText = useTechniqueText(tech)
  return (
    <Card as="article" className={cx('tr-ex tr-ro', x.skipped && 'is-skipped')} aria-labelledby={`ro-${x.index}`}>
      <div className="tr-ex__head">
        <div className="tr-ex__title">
          <p className="tr-ex__n">{t('exerciseN', { n: x.index + 1, total })}</p>
          <h2 className="tr-ex__name" id={`ro-${x.index}`}>
            <Link to={`/lift/${slug}/${encodeURIComponent(x.name)}`} title={l('viewLift', { name: x.name })} lang="en">
              {x.name}
            </Link>
          </h2>
        </div>
      </div>
      {x.machine || x.v || tech ? (
        <div className="tr-ex__tags">
          {x.machine ? <Chip icon="machine">{x.machine}</Chip> : null}
          {x.v ? <Chip icon="swap">{t('swapped')}</Chip> : null}
          {tech ? (
            <Chip icon="flame" title={techText ?? undefined}>
              {t('lastSet', { t: tech.label })}
            </Chip>
          ) : null}
        </div>
      ) : null}
      <SpecStrip e={e} />
      {x.skipped ? (
        <p className="tr-ro__skip">{l('skipped')}</p>
      ) : (
        <ol className="tr-ro__sets">
          {x.sets.map((s, j) => (
            <li key={j} className={cx('tr-ro__set', s.pr && 'is-pr')}>
              <b className="num tr-ro__n">{j + 1}</b>
              <span className="num tr-ro__v">
                {s.kg != null ? (
                  <>
                    {fmtNum(kgToUnit(s.kg, unit), 1)}
                    <small>{unit}</small>
                    <i className="mul">×</i>
                  </>
                ) : null}
                {s.reps}
              </span>
              {s.pr ? <PRBadge /> : s.extra ? <span className="tr-set__tq">{t('extra')}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
