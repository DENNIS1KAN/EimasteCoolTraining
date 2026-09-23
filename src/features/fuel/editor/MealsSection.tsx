import { useState } from 'react'
import { useT, type Vars } from '../../../i18n'
import { fmtNum } from '../../../lib/format'
import { uuid } from '../../../lib/ids'
import { Button, Card, Chip, IconButton, NumberField, Segmented, Tag, TextArea, TextField, cx } from '../../../ui'
import { foodById, foodName, unitLabel, type Food, type Macros } from '../foods'
import {
  customFoodDraft,
  draftPlanTotals,
  foodDraftMacros,
  foodDraftOf,
  mealDraftTotals,
  moveItem,
  resetFoodMacros,
  setFoodByPiece,
  setFoodGrams,
  setFoodMacro,
  setFoodPieces,
  type DraftErrors,
  type FoodDraft,
  type FoodField,
  type MealDraft,
  type MealField,
} from '../lib/draft'
import { checkTarget, type MacroField } from '../lib/macros'
import { FM } from '../messages'
import { errorKey } from './errors'
import { FoodSearch } from './FoodSearch'

type Suggest = { name: 'breakfast' | 'snack' | 'lunch' | 'afternoon' | 'dinner'; time: string }
const SUGGESTIONS: Suggest[] = [
  { name: 'breakfast', time: '08:00' },
  { name: 'snack', time: '11:00' },
  { name: 'lunch', time: '14:00' },
  { name: 'afternoon', time: '17:30' },
  { name: 'dinner', time: '21:00' },
]

type TFn = (k: keyof typeof FM.en, vars?: Vars) => string

/** "540 kcal · P 42 · C 60 · F 14" for a portion, meal or day. */
export function MacroLine({ m, t, className }: { m: Macros; t: TFn; className?: string }) {
  const g = (v: number | null) => (v == null ? '–' : fmtNum(v, v < 10 ? 1 : 0))
  return (
    <span
      className={cx('fu-mline num', className)}
      aria-label={t('macrosAria', { kcal: m.kcal == null ? '–' : fmtNum(m.kcal, 0), p: g(m.protein), c: g(m.carbs), f: g(m.fat) })}
    >
      <b aria-hidden="true">
        {m.kcal == null ? '–' : fmtNum(m.kcal, 0)}
        <small> kcal</small>
      </b>
      <span aria-hidden="true">
        {t('proteinShort')} {g(m.protein)}
      </span>
      <span aria-hidden="true">
        {t('carbsShort')} {g(m.carbs)}
      </span>
      <span aria-hidden="true">
        {t('fatShort')} {g(m.fat)}
      </span>
    </span>
  )
}

const MACRO_INPUTS: {
  key: MacroField
  label: 'mealKcal' | 'proteinShort' | 'carbsShort' | 'fatShort'
  aria: 'kcal' | 'protein' | 'carbs' | 'fat'
  suffix: string
}[] = [
  { key: 'kcal', label: 'mealKcal', aria: 'kcal', suffix: '' },
  { key: 'protein', label: 'proteinShort', aria: 'protein', suffix: 'g' },
  { key: 'carbs', label: 'carbsShort', aria: 'carbs', suffix: 'g' },
  { key: 'fat', label: 'fatShort', aria: 'fat', suffix: 'g' },
]

interface FoodRowProps {
  food: FoodDraft
  errors: DraftErrors['foods'][string] | undefined
  onChange: (f: FoodDraft) => void
  onRemove: () => void
}

function FoodRow({ food, errors, onChange, onRemove }: FoodRowProps) {
  const t = useT(FM)
  const db = foodById(food.ref)
  const unit = db?.unit
  const byPiece = !!unit && food.pieces !== ''
  const custom = !db
  const [open, setOpen] = useState(custom)
  const label = food.name.trim() || t('foodNameLabel')
  const err = (k: FoodField) => {
    const key = errorKey(errors?.[k])
    return key ? t(key) : undefined
  }
  const macroError = MACRO_INPUTS.some((m) => errors?.[m.key])
  const showEdit = open || macroError
  const pieces = byPiece ? Number(food.pieces) || 0 : 0

  return (
    <li id={`fu-food-${food.id}`} className={cx('fu-food', showEdit && 'is-open')}>
      <div className="fu-food__top">
        <TextField
          aria-label={t('foodNameLabel')}
          fieldClassName="fu-ed__grow"
          value={food.name}
          maxLength={60}
          error={err('name')}
          onChange={(e) => onChange({ ...food, name: e.target.value })}
        />
        <IconButton icon="x" label={t('removeFood', { name: label })} variant="ghost" size={36} onClick={onRemove} />
      </div>
      <div className="fu-food__amount">
        <NumberField
          aria-label={`${t('amount')}: ${label}`}
          fieldClassName="fu-food__qty"
          value={byPiece ? food.pieces : food.grams}
          decimals={1}
          min={0}
          suffix={byPiece && unit ? unitLabel(unit.kind, pieces) : 'g'}
          error={err(byPiece ? 'pieces' : 'grams')}
          onChange={(v) => onChange(byPiece ? setFoodPieces(food, v) : setFoodGrams(food, v))}
        />
        {unit && (
          <Segmented
            size="sm"
            ariaLabel={t('amountUnit', { name: label })}
            options={[
              { value: 'g', label: 'g', ariaLabel: t('inGrams') },
              { value: 'pc', label: unitLabel(unit.kind, 2), ariaLabel: t('inPieces') },
            ]}
            value={byPiece ? 'pc' : 'g'}
            onChange={(v) => onChange(setFoodByPiece(food, v === 'pc'))}
          />
        )}
        {byPiece && food.grams && <span className="fu-food__grams num">= {t('gramsShort', { n: fmtNum(Number(food.grams), 1) })}</span>}
        <div className="fu-food__sum">
          <MacroLine m={foodDraftMacros(food)} t={t} />
          {custom ? <Tag>{t('customTag')}</Tag> : food.manual ? <Tag tone="warn">{t('editedTag')}</Tag> : null}
          <IconButton
            icon="edit"
            label={t('editMacros', { name: label })}
            variant="ghost"
            size={36}
            className="fu-food__edit-btn"
            aria-expanded={showEdit}
            onClick={() => setOpen((o) => !o)}
          />
        </div>
      </div>
      {showEdit && (
        <div className="fu-food__edit">
          {custom && <p className="fu-hint">{t('customHint')}</p>}
          <div className="fu-food__macros">
            {MACRO_INPUTS.map((m) => (
              <NumberField
                key={m.key}
                label={t(m.label)}
                aria-label={`${t(m.aria === 'kcal' ? 'kcal' : m.aria)}: ${label}`}
                value={food[m.key]}
                decimals={m.key === 'kcal' ? 0 : 1}
                min={0}
                suffix={m.suffix || undefined}
                error={err(m.key)}
                onChange={(v) => onChange(setFoodMacro(food, m.key, v))}
              />
            ))}
          </div>
          {!custom && food.manual && (
            <Chip icon="refresh" size="sm" onClick={() => onChange(resetFoodMacros(food))}>
              {t('resetMacros')}
            </Chip>
          )}
        </div>
      )}
    </li>
  )
}

interface MealEditorProps {
  meal: MealDraft
  index: number
  count: number
  errors: DraftErrors | null
  onChange: (patch: Partial<MealDraft>) => void
  onMove: (to: number) => void
  onRemove: () => void
}

function MealEditor({ meal, index, count, errors, onChange, onMove, onRemove }: MealEditorProps) {
  const t = useT(FM)
  const name = meal.name.trim() || t('mealN', { n: index + 1 })
  const mealErrors = errors?.meals[meal.id]
  const err = (k: MealField) => {
    const key = errorKey(mealErrors?.[k])
    return key ? t(key) : undefined
  }
  const hasFoods = meal.foods.length > 0
  const legacyItems = !hasFoods && meal.items.trim().length > 0

  const addFood = (fd: FoodDraft) => {
    onChange({ foods: [...meal.foods, fd] })
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`#fu-food-${fd.id} .fu-food__${fd.ref ? 'qty' : 'macros'} input`)
      el?.focus()
      el?.select()
    })
  }
  const pick = (food: Food) => addFood(foodDraftOf(food, foodName(food), uuid()))
  const custom = (text: string) => addFood(customFoodDraft(text, uuid()))
  const setFood = (i: number, f: FoodDraft) => onChange({ foods: meal.foods.map((x, j) => (j === i ? f : x)) })

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
        <TextField
          type="time"
          fieldClassName="fu-ed__time"
          label={t('mealTime')}
          value={meal.time}
          error={err('time')}
          onChange={(e) => onChange({ time: e.target.value })}
        />
      </div>

      <div className="fu-ed__foods-wrap">
        <p className="fu-sub fu-ed__foods-h">{t('foods')}</p>
        {hasFoods ? (
          <ul className="fu-ed__foods">
            {meal.foods.map((f, i) => (
              <FoodRow
                key={f.id}
                food={f}
                errors={errors?.foods[f.id]}
                onChange={(x) => setFood(i, x)}
                onRemove={() => onChange({ foods: meal.foods.filter((x) => x.id !== f.id) })}
              />
            ))}
          </ul>
        ) : (
          <p className="fu-hint">{t('noFoodsYet')}</p>
        )}
        <FoodSearch mealName={name} onPick={pick} onCustom={custom} />
      </div>

      {hasFoods ? (
        <div className="fu-ed__meal-total">
          <span className="micro">{t('mealTotal')}</span>
          <MacroLine m={mealDraftTotals(meal)} t={t} />
        </div>
      ) : (
        <div className="fu-ed__meal-nums">
          {MACRO_INPUTS.map((m) => (
            <NumberField
              key={m.key}
              label={m.key === 'kcal' ? t('mealKcal') : t(m.aria === 'protein' ? 'mealProtein' : m.aria === 'carbs' ? 'mealCarbs' : 'mealFat')}
              value={meal[m.key]}
              decimals={0}
              min={0}
              suffix={m.suffix || undefined}
              error={err(m.key)}
              onChange={(v) => onChange({ [m.key]: v } as Partial<MealDraft>)}
            />
          ))}
        </div>
      )}

      <TextArea
        label={legacyItems ? t('mealItems') : t('mealNotes')}
        hint={legacyItems ? t('mealItemsHint') : t('mealNotesHint')}
        rows={2}
        value={meal.items}
        onChange={(e) => onChange({ items: e.target.value })}
      />
      <div className="fu-ed__meal-tools">
        <IconButton
          icon="arrow-up"
          label={t('moveUp', { name })}
          variant="ghost"
          size={40}
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        />
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
  /** The plan's kcal target (typed), for the day-total line. */
  kcalTarget: number | null
  onChange: (meals: MealDraft[]) => void
}

export function MealsSection({ meals, errors, kcalTarget, onChange }: MealsSectionProps) {
  const t = useT(FM)
  const add = () => {
    const s = SUGGESTIONS[meals.length]
    const id = uuid()
    onChange([...meals, { id, name: s ? t(s.name) : '', time: s?.time ?? '', items: '', kcal: '', protein: '', carbs: '', fat: '', foods: [] }])
    requestAnimationFrame(() => {
      const el = document.getElementById(`fu-meal-${id}-name`) as HTMLInputElement | null
      el?.focus()
      el?.select()
    })
  }
  const patch = (i: number, p: Partial<MealDraft>) => onChange(meals.map((m, j) => (j === i ? { ...m, ...p } : m)))
  const day = draftPlanTotals(meals)
  const kcal = checkTarget('kcal', day.kcal, kcalTarget)
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
              errors={errors}
              onChange={(p) => patch(i, p)}
              onMove={(to) => onChange(moveItem(meals, i, to))}
              onRemove={() => onChange(meals.filter((x) => x.id !== m.id))}
            />
          ))}
        </ol>
      )}
      {day.kcal != null && (
        <div className="fu-ed__day" aria-live="polite">
          <div className="fu-ed__day-head">
            <span className="micro">{t('dayTotal')}</span>
            {kcal.verdict && kcal.diff != null && (
              <Tag
                tone={kcal.verdict === 'on' ? 'good' : 'warn'}
                icon={kcal.verdict === 'on' ? 'check' : kcal.verdict === 'over' ? 'arrow-up' : 'arrow-down'}
              >
                {kcal.verdict === 'on'
                  ? t('onTarget')
                  : t(kcal.verdict === 'over' ? 'overBy' : 'underBy', { d: `${fmtNum(Math.abs(kcal.diff), 0)} kcal` })}
              </Tag>
            )}
          </div>
          <MacroLine m={day} t={t} />
        </div>
      )}
      <Button variant="secondary" icon="plus" block onClick={add}>
        {t('addMeal')}
      </Button>
    </Card>
  )
}
