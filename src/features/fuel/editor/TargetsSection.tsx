import { useT } from '../../../i18n'
import { fmtNum } from '../../../lib/format'
import { parseNum } from '../../../lib/units'
import { Card, Chip, NumberField } from '../../../ui'
import { draftMacroKcal, draftMealsKcal, type TargetKey } from '../lib/draft'
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

/** Daily targets with a live 4/4/9 check against the calorie target. */
export function TargetsSection({ draft, errors, onChange }: SectionProps) {
  const t = useT(FM)
  const macroKcal = draftMacroKcal(draft)
  const mealsKcal = draftMealsKcal(draft.meals)
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
      {(macroKcal != null || mealsKcal != null) && (
        <div className="fu-ed__calc" aria-live="polite">
          {macroKcal != null && (
            <p>
              {t('macroKcal', { n: fmtNum(macroKcal, 0) })}
              {diff != null && Math.abs(diff) >= 25 && <span className="fu-ed__warn"> · {t('macroDiff', { d: fmtNum(Math.abs(diff), 0) })}</span>}
            </p>
          )}
          {mealsKcal != null && <p>{t('mealsKcal', { n: fmtNum(mealsKcal, 0) })}</p>}
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
