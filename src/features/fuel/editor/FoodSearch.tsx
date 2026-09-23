import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useLang, useT } from '../../../i18n'
import { fmtNum } from '../../../lib/format'
import { Icon, cx } from '../../../ui'
import { foodName, macrosFor, searchFoods, unitLabel, type Food } from '../foods'
import { FM } from '../messages'

export interface FoodSearchProps {
  mealName: string
  onPick: (food: Food) => void
  onCustom: (name: string) => void
}

/**
 * Type-ahead over the built-in food database (English, Greek or Greeklish, accents optional). The last option adds
 * what was typed as the coach's own food. Results sit in the flow under the field (no popup to clip on a phone).
 */
export function FoodSearch({ mealName, onPick, onCustom }: FoodSearchProps) {
  const t = useT(FM)
  const lang = useLang()
  const listId = useId()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const results = useMemo(() => searchFoods(q, lang, 7), [q, lang])
  const query = q.trim()
  const count = results.length + (query ? 1 : 0)
  const open = query.length > 0

  const reset = () => {
    setQ('')
    setActive(0)
  }
  const choose = (i: number) => {
    if (i < results.length) onPick(results[i])
    else if (query) onCustom(query)
    reset()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % count)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + count) % count)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(Math.min(active, count - 1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      reset()
    }
  }
  const optId = (i: number) => `${listId}-o${i}`

  return (
    <div className="fu-fs">
      <div className="ui-control has-icon fu-fs__control">
        <span className="ui-control__icon">
          <Icon name="search" size={18} />
        </span>
        <input
          className="ui-control__input"
          type="text"
          role="combobox"
          aria-label={t('foodSearchLabel', { meal: mealName })}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? optId(Math.min(active, count - 1)) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder={t('foodSearchPh')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label={t('foodResults', { q: query })} className="fu-fs__list">
          {results.map((f, i) => {
            const per = f.unit ? f.unit.g : 100
            const m = macrosFor(f, per)
            const other = foodName(f, lang === 'el' ? 'en' : 'el')
            return (
              <li
                key={f.id}
                id={optId(i)}
                role="option"
                aria-selected={i === active}
                className={cx('fu-fs__opt', i === active && 'is-active')}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="fu-fs__name">{foodName(f, lang)}</span>
                <span className="fu-fs__sub">
                  <span className="fu-fs__other">{other}</span>
                  <span className="fu-fs__macros num">
                    {fmtNum(m.kcal ?? 0, 0)} kcal · {t('proteinShort')} {fmtNum(m.protein ?? 0, 1)} · {t('carbsShort')} {fmtNum(m.carbs ?? 0, 1)} ·{' '}
                    {t('fatShort')} {fmtNum(m.fat ?? 0, 1)}
                    <small>{f.unit ? t('perUnit', { unit: unitLabel(f.unit.kind, 1, lang), g: fmtNum(f.unit.g, 1) }) : t('per100')}</small>
                  </span>
                </span>
              </li>
            )
          })}
          <li
            id={optId(results.length)}
            role="option"
            aria-selected={active === results.length}
            className={cx('fu-fs__opt fu-fs__custom', active === results.length && 'is-active')}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(results.length)}
            onClick={() => choose(results.length)}
          >
            <Icon name="plus" size={16} />
            <span>
              <span className="fu-fs__name">{t('addCustom', { name: query })}</span>
              <span className="fu-fs__sub">{t('addCustomHint')}</span>
            </span>
          </li>
        </ul>
      )}
    </div>
  )
}
