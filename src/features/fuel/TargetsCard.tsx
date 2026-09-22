import { useT } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { Card } from '../../ui'
import { ProgressRing } from '../../ui/charts'
import type { DaySummary, MacroProgress } from './lib/day'
import { FM } from './messages'

const SHORT = { protein: 'proteinShort', carbs: 'carbsShort', fat: 'fatShort' } as const

function MacroRow({ m }: { m: MacroProgress }) {
  const t = useT(FM)
  const name = t(m.key)
  const target = m.target ?? 0
  const ratio = m.eaten != null && target > 0 ? Math.min(1, m.eaten / target) : 0
  const aria =
    m.eaten == null
      ? t('macroAriaTarget', { name, target: fmtNum(target, 0) })
      : t(m.mode === 'estimate' ? 'macroAriaEst' : 'macroAria', { name, eaten: fmtNum(m.eaten, 0), target: fmtNum(target, 0) })
  return (
    <div className={`fu-macro${m.eaten == null ? ' is-target' : ''}`}>
      <div className="fu-macro__head" aria-hidden="true">
        <span className="fu-macro__name">
          <b>{t(SHORT[m.key])}</b>
          {name}
        </span>
        <span className="fu-macro__val num">
          {m.eaten != null ? (
            <>
              {m.mode === 'estimate' && m.eaten > 0 && <i className="approx">≈</i>}
              {fmtNum(m.eaten, 0)}
              <small> / {fmtNum(target, 0)} g</small>
            </>
          ) : (
            <>
              {fmtNum(target, 0)}
              <small> g {t('target')}</small>
            </>
          )}
        </span>
      </div>
      <div className="fu-macro__bar" role="meter" aria-label={aria} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(m.eaten ?? 0)}>
        <i style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}

/** kcal ring (kcal left) and macro bars for one day. */
export function TargetsCard({ summary }: { summary: DaySummary }) {
  const t = useT(FM)
  const macros = summary.macros.filter((m) => m.target != null)
  const { kcalTarget, kcalEaten, kcalLeft } = summary
  const hasRing = kcalTarget != null || summary.mealsTotal > 0
  if (!hasRing && !macros.length) return null
  const estimated = macros.some((m) => m.mode === 'estimate' && (m.eaten ?? 0) > 0)

  let ring = null
  if (kcalTarget != null && kcalEaten != null && kcalLeft != null) {
    const over = kcalLeft < 0
    ring = (
      <ProgressRing
        value={kcalTarget > 0 ? kcalEaten / kcalTarget : 0}
        size={96}
        stroke={8.5}
        color="var(--accent-strong)"
        trackColor="var(--surface-3)"
        ariaLabel={
          over
            ? t('ringAriaOver', { eaten: fmtNum(kcalEaten, 0), target: fmtNum(kcalTarget, 0), over: fmtNum(-kcalLeft, 0) })
            : t('ringAria', { eaten: fmtNum(kcalEaten, 0), target: fmtNum(kcalTarget, 0), left: fmtNum(kcalLeft, 0) })
        }
      >
        <span className="fu-ring">
          <span className="fu-ring__v num">{fmtNum(Math.abs(kcalLeft), 0)}</span>
          <small>{over ? t('kcalOver') : t('kcalLeft')}</small>
          <small>{t('ofN', { n: fmtNum(kcalTarget, 0) })}</small>
        </span>
      </ProgressRing>
    )
  } else if (kcalTarget != null) {
    ring = (
      <div className="fu-ring fu-ring--static" role="img" aria-label={`${fmtNum(kcalTarget, 0)} ${t('kcalTarget')}`}>
        <span className="fu-ring__v num">{fmtNum(kcalTarget, 0)}</span>
        <small>{t('kcalTarget')}</small>
      </div>
    )
  } else if (summary.mealsTotal > 0) {
    ring = (
      <ProgressRing
        value={summary.mealsTicked / summary.mealsTotal}
        size={96}
        stroke={8.5}
        color="var(--accent-strong)"
        trackColor="var(--surface-3)"
        ariaLabel={t('ringMealsAria', { x: summary.mealsTicked, y: summary.mealsTotal })}
      >
        <span className="fu-ring">
          <span className="fu-ring__v num">
            {summary.mealsTicked}
            <span className="fu-ring__of">/{summary.mealsTotal}</span>
          </span>
          <small>{t('meals').toLowerCase()}</small>
        </span>
      </ProgressRing>
    )
  }

  return (
    <Card as="section" className="fu-targets" aria-label={t('targets')}>
      <div className="fu-targets__row">
        {ring}
        {macros.length > 0 && (
          <div className="fu-macros">
            {macros.map((m) => (
              <MacroRow key={m.key} m={m} />
            ))}
          </div>
        )}
      </div>
      {estimated && <p className="fu-targets__note">{t('estimateNote')}</p>}
    </Card>
  )
}
