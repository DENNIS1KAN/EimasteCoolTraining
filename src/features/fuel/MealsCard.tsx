import { useId, useState } from 'react'
import type { Meal } from '../../data/types'
import { useT } from '../../i18n'
import { fmtNum } from '../../lib/format'
import { Card, Icon } from '../../ui'
import { FM } from './messages'

const foodsOf = (m: Meal): string[] =>
  m.items
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

interface MealRowProps {
  meal: Meal
  done: boolean
  next: boolean
  readOnly?: boolean
  onToggle: () => void
}

function MealRow({ meal, done, next, readOnly, onToggle }: MealRowProps) {
  const t = useT(FM)
  const [open, setOpen] = useState(false)
  const foodsId = useId()
  const foods = foodsOf(meal)
  const summary = foods.join(', ')
  const label = (
    <>
      <span className="fu-meal__name">
        {meal.name}
        {meal.time && <span className="fu-meal__time">{meal.time}</span>}
        {next && <em className="fu-next-tag">{t('next')}</em>}
      </span>
      {summary && !open && <span className="fu-meal__foods">{summary}</span>}
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
        {foods.length ? (
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
        {meal.kcal != null && (
          <span className="fu-meal__kcal num">
            {fmtNum(meal.kcal, 0)}
            <small>kcal</small>
          </span>
        )}
      </div>
      {open && foods.length > 0 && (
        <div id={foodsId} className="fu-meal__detail">
          <ul>
            {foods.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          {meal.protein != null && (
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
