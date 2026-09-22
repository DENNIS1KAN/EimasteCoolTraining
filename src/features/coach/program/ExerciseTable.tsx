import { Icon, Tag } from '../../../ui'
import { useT } from '../../../i18n'
import type { ProgramDay, ProgramExercise } from '../../../data/types'
import { enDash, splitApprox, techniqueOf } from '../lib/programs'
import { M } from '../messages'

/** "~8–9" with the tilde set in the UI font (the condensed one reads like a dash). */
function Approx({ s }: { s: string | undefined }) {
  const { approx, value } = splitApprox(s)
  return (
    <>
      {approx ? <span className="approx">~</span> : null}
      {value || '–'}
    </>
  )
}

/**
 * A day's exercises as a table (name, sets × reps, RPE early / last, rest, last-set technique, swaps).
 * Below 760 px each row becomes a compact card with labelled cells; roles keep the table semantics.
 */
export function ExerciseTable({ day }: { day: ProgramDay }) {
  const t = useT(M)
  return (
    <table className="ex-table" role="table">
      <thead role="rowgroup">
        <tr role="row">
          <th role="columnheader" scope="col" className="ex-table__idx">
            <span className="visually-hidden">#</span>
          </th>
          <th role="columnheader" scope="col">
            {t('colExercise')}
          </th>
          <th role="columnheader" scope="col">
            {t('colSetsReps')}
          </th>
          <th role="columnheader" scope="col">
            {t('colRpe')}
          </th>
          <th role="columnheader" scope="col">
            {t('colRest')}
          </th>
          <th role="columnheader" scope="col" className="ex-table__tech-col">
            {t('colTechnique')}
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup">
        {day.ex.map((e, i) => (
          <ExerciseRow key={i} e={e} i={i} />
        ))}
      </tbody>
    </table>
  )
}

function ExerciseRow({ e, i }: { e: ProgramExercise; i: number }) {
  const t = useT(M)
  const tech = techniqueOf(e.t)
  const subs = [e.s1, e.s2].filter((s): s is string => !!s && !!s.trim())
  const warm = enDash(e.w)
  return (
    <tr role="row" className="ex-row">
      <td role="cell" className="ex-row__idx num">
        {i + 1}
      </td>
      <td role="cell" className="ex-row__main">
        <div className="ex-row__name">
          <span>{e.n}</span>
          {e.v ? (
            <a className="ex-row__video" href={e.v} target="_blank" rel="noreferrer" aria-label={t('videoA11y', { name: e.n })}>
              <Icon name="video" size={16} />
            </a>
          ) : null}
        </div>
        <div className="ex-row__tags">
          {tech ? (
            <Tag tone="accent" className="ex-row__tech-tag">
              {t('colTechnique')} · {tech}
            </Tag>
          ) : null}
          {warm && warm !== '0' ? <span className="ex-row__warm">{t('warmupN', { n: warm })}</span> : null}
        </div>
        {subs.length ? (
          <p className="ex-row__subs">
            <Icon name="swap" size={14} />
            <span className="visually-hidden">{t('colSubs')}: </span>
            {subs.join(' · ')}
          </p>
        ) : null}
        {e.note ? <p className="ex-row__note">{e.note}</p> : null}
      </td>
      <td role="cell" className="ex-row__cell" data-label={t('colSetsReps')}>
        <span className="num ex-row__val">
          {enDash(e.s) || '–'}
          <span className="mul">×</span>
          {enDash(e.r) || '–'}
        </span>
      </td>
      <td role="cell" className="ex-row__cell" data-label={t('colRpeShort')}>
        <span className="num ex-row__val">
          <Approx s={e.e} />
          <span className="ex-row__slash">/</span>
          <Approx s={e.l} />
        </span>
      </td>
      <td role="cell" className="ex-row__cell" data-label={t('colRest')}>
        <span className="ex-row__rest">{enDash(e.rest) || '–'}</span>
      </td>
      <td role="cell" className="ex-row__cell ex-row__tech" data-label={t('colTechnique')}>
        {tech ? <span className="ex-row__tech-text">{tech}</span> : <span className="muted">{t('none')}</span>}
      </td>
    </tr>
  )
}
