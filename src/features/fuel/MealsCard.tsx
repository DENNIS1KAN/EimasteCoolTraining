import { useId, useState } from 'react'
import type { Meal } from '../../data/types'
import { useLang, useT } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { Card, Icon } from '../../ui'
import { amountText } from './foodText'
import { displayFoodName } from './foods'
import { hasFoods, mealTotals } from './lib/macros'
import type { Macros } from './foods'
import { FM } from './messages'

const lines = (s: string): string[] =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const g = (v: number) => fmtNum(v, v < 10 ? 1 : 0)

/** "P 42 · C 60 · F 14 g" (only the macros the meal has). */
function MacroMini({ m }: { m: Macros }) {
  const t = useT(FM)
  const parts = (['protein', 'carbs', 'fat'] as const).filter((k) => m[k] != null)
  if (!parts.length) return null
  return (
    <span className="fu-meal__macros num">
      {parts.map((k) => (
        <span key={k}>
          <b>{t(k === 'protein' ? 'proteinShort' : k === 'carbs' ? 'carbsShort' : 'fatShort')}</b> {g(m[k] as number)}
        </span>
      ))}
      <span>g</span>
    </span>
  )
}

interface MealRowProps {
  meal: Meal
  done: boolean
  next: boolean
  readOnly?: boolean
  onToggle: () => void
}

function MealRow({ meal, done, next, readOnly, onToggle }: MealRowProps) {
  const t = useT(FM)
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const foodsId = useId()
  const withFoods = hasFoods(meal)
  const foods = withFoods ? meal.foods : []
  const legacy = withFoods ? [] : lines(meal.items)
  const notes = withFoods ? meal.items.trim() : ''
  const totals = mealTotals(meal)
  const summary = withFoods ? foods.map((f) => displayFoodName(f, lang)).join(', ') : legacy.join(', ')
  const expandable = foods.length > 0 || legacy.length > 0
  const label = (
    <>
      <span className="fu-meal__name">
        {meal.name}
        {meal.time && <span className="fu-meal__time">{meal.time}</span>}
        {next && <em className="fu-next-tag">{t('next')}</em>}
      </span>
      {summary && !open && <span className="fu-meal__foods">{summary}</span>}
      <MacroMini m={totals} />
    </>
  )
  const cls = `fu-meal${done ? ' is-done' : ''}${next ? ' is-next' : ''}${open ? ' is-open' : ''}`
  return (
    <li className={cls}>
      <div className="fu-meal__row">
        <button
          type="button"
          className="fu-tick"
          role="checkbox"
          aria-checked={done}
          aria-label={meal.time ? t('mealAria', { name: meal.name, time: meal.time }) : meal.name}
          disabled={readOnly}
          onClick={onToggle}
        >
          <span className="fu-tick__box">{done && <Icon name="check" size={15} strokeWidth={2.8} />}</span>
        </button>
        {expandable ? (
          <button
            type="button"
            className="fu-meal__body"
            aria-expanded={open}
            aria-controls={foodsId}
            aria-label={t('showFoods', { name: meal.name })}
            onClick={() => setOpen((o) => !o)}
          >
            {label}
          </button>
        ) : (
          <div className="fu-meal__body">{label}</div>
        )}
        {totals.kcal != null && (
          <span className="fu-meal__kcal num">
            {fmtNum(totals.kcal, 0)}
            <small>kcal</small>
          </span>
        )}
        {expandable && <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} className="fu-meal__chev" />}
      </div>
      {open && expandable && (
        <div id={foodsId} className="fu-meal__detail">
          {withFoods ? (
            <ul className="fu-foods">
              {foods.map((f) => {
                const amount = amountText(f, lang)
                return (
                  <li key={f.id} className="fu-foods__row">
                    <span className="fu-foods__main">
                      <span className="fu-foods__name">{displayFoodName(f, lang)}</span>
                      {amount && <span className="fu-foods__amt num">{amount}</span>}
                    </span>
                    <span className="fu-foods__nums num">
                      {f.kcal != null && (
                        <span className="fu-foods__kcal">
                          {fmtNum(f.kcal, 0)}
                          <small> kcal</small>
                        </span>
                      )}
                      <MacroMini m={f} />
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <ul>
              {legacy.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          {notes && <p className="fu-meal__notes">{notes}</p>}
          {!withFoods && meal.protein != null && (
            <p className="fu-meal__protein">
              <b className="num">{fmtNum(meal.protein, 0)} g</b> {t('protein').toLowerCase()}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

export interface MealsCardProps {
  title: string
  meals: Meal[]
  ticked: readonly string[]
  nextId: string | null
  readOnly?: boolean
  onToggle: (mealId: string) => void
}

/** Today's meals checklist: tick what you ate as planned; the next meal by time is highlighted. */
export function MealsCard({ title, meals, ticked, nextId, readOnly, onToggle }: MealsCardProps) {
  const headId = useId()
  const done = new Set(ticked)
  const count = meals.filter((m) => done.has(m.id)).length
  return (
    <Card as="section" className="fu-meals" aria-labelledby={headId}>
      <div className="fu-meals__head">
        <h2 id={headId} className="fu-h">
          {title}
        </h2>
        <span className="fu-meals__count num" aria-hidden="true">
          {count}
          <span>/{meals.length}</span>
        </span>
      </div>
      <ul className="fu-meals__list">
        {meals.map((m) => (
          <MealRow key={m.id} meal={m} done={done.has(m.id)} next={m.id === nextId} readOnly={readOnly} onToggle={() => onToggle(m.id)} />
        ))}
      </ul>
    </Card>
  )
}
