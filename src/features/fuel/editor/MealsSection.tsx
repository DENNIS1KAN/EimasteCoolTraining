import { useT } from '../../../i18n'
import { uuid } from '../../../lib/ids'
import { Button, Card, IconButton, NumberField, TextArea, TextField } from '../../../ui'
import { moveItem, type DraftErrors, type MealDraft } from '../lib/draft'
import { FM } from '../messages'
import { errorKey } from './errors'

type Suggest = { name: 'breakfast' | 'snack' | 'lunch' | 'afternoon' | 'dinner'; time: string }
const SUGGESTIONS: Suggest[] = [
  { name: 'breakfast', time: '08:00' },
  { name: 'snack', time: '11:00' },
  { name: 'lunch', time: '14:00' },
  { name: 'afternoon', time: '17:30' },
  { name: 'dinner', time: '21:00' },
]

interface MealEditorProps {
  meal: MealDraft
  index: number
  count: number
  errors: DraftErrors['meals'][string] | undefined
  onChange: (patch: Partial<MealDraft>) => void
  onMove: (to: number) => void
  onRemove: () => void
}

function MealEditor({ meal, index, count, errors, onChange, onMove, onRemove }: MealEditorProps) {
  const t = useT(FM)
  const name = meal.name.trim() || t('mealN', { n: index + 1 })
  const err = (k: 'name' | 'time' | 'kcal' | 'protein') => {
    const key = errorKey(errors?.[k])
    return key ? t(key) : undefined
  }
  return (
    <li className="fu-ed__meal">
      <div className="fu-ed__meal-top">
        <span className="fu-ed__idx num" aria-hidden="true">
          {index + 1}
        </span>
        <TextField
          id={`fu-meal-${meal.id}-name`}
          fieldClassName="fu-ed__grow"
          label={t('mealName')}
          value={meal.name}
          maxLength={40}
          error={err('name')}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      <div className="fu-ed__meal-nums">
        <TextField type="time" label={t('mealTime')} value={meal.time} error={err('time')} onChange={(e) => onChange({ time: e.target.value })} />
        <NumberField label={t('mealKcal')} value={meal.kcal} decimals={0} min={0} error={err('kcal')} onChange={(v) => onChange({ kcal: v })} />
        <NumberField label={t('mealProtein')} value={meal.protein} decimals={0} min={0} suffix="g" error={err('protein')} onChange={(v) => onChange({ protein: v })} />
      </div>
      <TextArea
        label={t('mealItems')}
        hint={t('mealItemsHint')}
        rows={3}
        value={meal.items}
        onChange={(e) => onChange({ items: e.target.value })}
      />
      <div className="fu-ed__meal-tools">
        <IconButton icon="arrow-up" label={t('moveUp', { name })} variant="ghost" size={40} disabled={index === 0} onClick={() => onMove(index - 1)} />
        <IconButton
          icon="arrow-down"
          label={t('moveDown', { name })}
          variant="ghost"
          size={40}
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
        />
        <IconButton icon="trash" label={t('removeMeal', { name })} variant="ghost" size={40} className="fu-ed__danger" onClick={onRemove} />
      </div>
    </li>
  )
}

export interface MealsSectionProps {
  meals: MealDraft[]
  errors: DraftErrors | null
  onChange: (meals: MealDraft[]) => void
}

export function MealsSection({ meals, errors, onChange }: MealsSectionProps) {
  const t = useT(FM)
  const add = () => {
    const s = SUGGESTIONS[meals.length]
    const id = uuid()
    onChange([...meals, { id, name: s ? t(s.name) : '', time: s?.time ?? '', items: '', kcal: '', protein: '' }])
    requestAnimationFrame(() => {
      const el = document.getElementById(`fu-meal-${id}-name`) as HTMLInputElement | null
      el?.focus()
      el?.select()
    })
  }
  const patch = (i: number, p: Partial<MealDraft>) => onChange(meals.map((m, j) => (j === i ? { ...m, ...p } : m)))
  return (
    <Card as="section" className="fu-ed__card" aria-labelledby="fu-ed-meals">
      <div className="row-between">
        <h2 id="fu-ed-meals" className="fu-h">
          {t('meals')}
        </h2>
        {meals.length > 0 && <span className="fu-ed__count num">{meals.length}</span>}
      </div>
      {meals.length === 0 ? (
        <p className="fu-hint">{t('noMealsEditor')}</p>
      ) : (
        <ol className="fu-ed__meals">
          {meals.map((m, i) => (
            <MealEditor
              key={m.id}
              meal={m}
              index={i}
              count={meals.length}
              errors={errors?.meals[m.id]}
              onChange={(p) => patch(i, p)}
              onMove={(to) => onChange(moveItem(meals, i, to))}
              onRemove={() => onChange(meals.filter((x) => x.id !== m.id))}
            />
          ))}
        </ol>
      )}
      <Button variant="secondary" icon="plus" block onClick={add}>
        {t('addMeal')}
      </Button>
    </Card>
  )
}
