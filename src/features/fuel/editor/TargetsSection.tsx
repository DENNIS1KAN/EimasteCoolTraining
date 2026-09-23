import { useT } from '../../../i18n'
import { fmtNum } from '../../../lib/format'
import { parseNum } from '../../../lib/units'
import { Card, Chip, Icon, NumberField, cx, toast } from '../../../ui'
import { draftMacroKcal, draftPlanTotals, type TargetKey } from '../lib/draft'
import { checkTarget, MACRO_FIELDS, type MacroField } from '../lib/macros'
import { FM } from '../messages'
import type { SectionProps } from './BasicsSection'
import { errorKey } from './errors'

const FIELDS: { key: TargetKey; label: 'kcal' | 'protein' | 'carbs' | 'fat' | 'waterL'; suffix: string; decimals: number }[] = [
  { key: 'kcal', label: 'kcal', suffix: 'kcal', decimals: 0 },
  { key: 'waterL', label: 'waterL', suffix: 'L', decimals: 2 },
  { key: 'protein', label: 'protein', suffix: 'g', decimals: 0 },
  { key: 'carbs', label: 'carbs', suffix: 'g', decimals: 0 },
  { key: 'fat', label: 'fat', suffix: 'g', decimals: 0 },
]

const ROW_LABEL: Record<MacroField, 'kcal' | 'protein' | 'carbs' | 'fat'> = { kcal: 'kcal', protein: 'protein', carbs: 'carbs', fat: 'fat' }

/** Daily targets with a live 4/4/9 check, and the meals' totals against each target. */
export function TargetsSection({ draft, errors, onChange }: SectionProps) {
  const t = useT(FM)
  const macroKcal = draftMacroKcal(draft)
  const totals = draftPlanTotals(draft.meals)
  const mealsKcal = totals.kcal
  const checks = MACRO_FIELDS.map((f) => checkTarget(f, totals[f], parseNum(draft[f])))
  const anyTotals = MACRO_FIELDS.some((f) => totals[f] != null)
  const differs = MACRO_FIELDS.some((f) => totals[f] != null && totals[f] !== parseNum(draft[f]))
  const setFromMeals = () => {
    const patch: Partial<typeof draft> = {}
    for (const f of MACRO_FIELDS) {
      const v = totals[f]
      if (v != null) patch[f] = String(Math.round(v))
    }
    onChange(patch)
    toast(t('targetsFromMealsToast'), { tone: 'good' })
  }
  const kcal = parseNum(draft.kcal)
  const diff = macroKcal != null && kcal != null ? macroKcal - kcal : null
  const offer = macroKcal != null && macroKcal > 0 && (kcal == null || Math.abs(diff ?? 0) >= 25)
  const field = (f: (typeof FIELDS)[number]) => {
    const key = errorKey(errors?.fields[f.key])
    return (
      <NumberField
        key={f.key}
        label={t(f.label)}
        value={draft[f.key]}
        decimals={f.decimals}
        min={0}
        suffix={f.suffix}
        error={key ? t(key) : undefined}
        onChange={(v) => onChange({ [f.key]: v } as Partial<typeof draft>)}
      />
    )
  }
  return (
    <Card as="section" className="fu-ed__card" aria-labelledby="fu-ed-targets">
      <h2 id="fu-ed-targets" className="fu-h">
        {t('targets')}
      </h2>
      <div className="grid-2">{FIELDS.slice(0, 2).map(field)}</div>
      <div className="grid-3">{FIELDS.slice(2).map(field)}</div>
      {anyTotals && (
        <div className="fu-ed__vs" aria-live="polite">
          <table className="fu-ed__vs-table">
            <caption className="micro">{t('mealsVsTargets')}</caption>
            <thead className="visually-hidden">
              <tr>
                <th scope="col" />
                <th scope="col">{t('colMeals')}</th>
                <th scope="col">{t('colTarget')}</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => {
                const unit = c.field === 'kcal' ? ' kcal' : ' g'
                return (
                  <tr key={c.field} className={cx(c.verdict && `is-${c.verdict}`)}>
                    <th scope="row">{t(ROW_LABEL[c.field])}</th>
                    <td className="num">{c.total == null ? '–' : fmtNum(c.total, 0)}</td>
                    <td className="num fu-ed__vs-target">
                      {c.target == null ? t('noTargetSet') : `/ ${fmtNum(c.target, 0)}${unit}`}
                    </td>
                    <td className="fu-ed__vs-verdict">
                      {c.verdict && c.diff != null && (
                        <span>
                          <Icon name={c.verdict === 'on' ? 'check' : c.verdict === 'over' ? 'arrow-up' : 'arrow-down'} size={14} strokeWidth={2.4} />
                          {c.verdict === 'on'
                            ? t('onTarget')
                            : t(c.verdict === 'over' ? 'overBy' : 'underBy', { d: `${fmtNum(Math.abs(c.diff), 0)}${unit}` })}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {differs && (
            <Chip icon="target" tone="accent" onClick={setFromMeals}>
              {t('setFromMeals')}
            </Chip>
          )}
        </div>
      )}
      {macroKcal != null && (
        <div className="fu-ed__calc" aria-live="polite">
          {macroKcal != null && (
            <p>
              {t('macroKcal', { n: fmtNum(macroKcal, 0) })}
              {diff != null && Math.abs(diff) >= 25 && <span className="fu-ed__warn"> · {t('macroDiff', { d: fmtNum(Math.abs(diff), 0) })}</span>}
            </p>
          )}
          {mealsKcal != null && !anyTotals && <p>{t('mealsKcal', { n: fmtNum(mealsKcal, 0) })}</p>}
          {offer && macroKcal != null && (
            <Chip icon="bolt" tone="accent" onClick={() => onChange({ kcal: String(macroKcal) })}>
              {t('useKcal', { n: `${fmtNum(macroKcal, 0)} kcal` })}
            </Chip>
          )}
        </div>
      )}
    </Card>
  )
}
