import { useMemo, useState } from 'react'
import type { Unit, WeightEntry } from '../../data/types'
import { useT } from '../../i18n'
import { fmtDate, fmtNum } from '../../lib/format'
import { kgToUnit } from '../../lib/units'
import { Button, Icon, SectionTitle } from '../../ui'
import { dirOf, historyRows, toneOf, type Phase } from './logic'
import { M } from './messages'
import { wNum, wSigned } from './format'

const PAGE = 10

/** Weigh-ins, newest first, with the change vs the previous one. Rows open the edit sheet when editable. */
export function HistoryList({
  entries,
  unit,
  phase,
  onEdit,
}: {
  entries: WeightEntry[]
  unit: Unit
  phase: Phase | null
  onEdit?: (entry: WeightEntry) => void
}) {
  const t = useT(M)
  const [all, setAll] = useState(false)
  const rows = useMemo(() => historyRows(entries), [entries])
  if (!rows.length) return null
  const shown = all ? rows : rows.slice(0, PAGE)
  return (
    <section className="body-history" aria-labelledby="body-history-title">
      <SectionTitle
        title={<span id="body-history-title">{t('history')}</span>}
        action={<span className="body-history__count num">{rows.length}</span>}
      />
      <ul className="body-history__list">
        {shown.map(({ entry, deltaKg }) => {
          const dir = deltaKg == null ? 'flat' : dirOf(deltaKg)
          const tone = deltaKg == null ? 'neutral' : toneOf(deltaKg, phase, null)
          const inner = (
            <>
              <span className="body-history__date">
                <b>{fmtDate(entry.date, 'weekday')}</b> {fmtDate(entry.date, 'dayMonth')}
                {entry.note ? <Icon name="note" size={14} className="body-history__note" title={t('hasNote')} /> : null}
              </span>
              <span className="body-history__value num">
                {wNum(entry.kg, unit)}
                <small>{unit}</small>
              </span>
              <span className={`body-history__delta num is-${tone}`}>
                {deltaKg == null ? (
                  <span className="body-history__first">{t('firstEntry')}</span>
                ) : (
                  <>
                    {dir !== 'flat' && <Icon name={dir === 'down' ? 'arrow-down' : 'arrow-up'} size={12} strokeWidth={2.4} />}
                    <span className="visually-hidden">{t('changeVsPrev', { value: wSigned(deltaKg, unit) })}</span>
                    <span aria-hidden="true">{fmtNum(Math.abs(kgToUnit(deltaKg, unit)), 1, 1)}</span>
                  </>
                )}
              </span>
            </>
          )
          return (
            <li key={entry.id}>
              {onEdit ? (
                <button type="button" className="body-history__row" onClick={() => onEdit(entry)}>
                  {inner}
                </button>
              ) : (
                <div className="body-history__row">{inner}</div>
              )}
            </li>
          )
        })}
      </ul>
      {rows.length > PAGE && (
        <Button variant="ghost" size="sm" block onClick={() => setAll((v) => !v)} iconRight={all ? 'chevron-up' : 'chevron-down'}>
          {all ? t('showLess') : t('showAll', { n: rows.length })}
        </Button>
      )}
    </section>
  )
}
