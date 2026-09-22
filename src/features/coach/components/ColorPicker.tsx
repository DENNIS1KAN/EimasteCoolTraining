import { useId, useRef, type KeyboardEvent } from 'react'
import { MEMBER_COLORS, type MemberColor } from '../../../data/types'
import { useT } from '../../../i18n'
import { cx, Icon, initials, memberColorVar } from '../../../ui'
import { M, type CoachKey } from '../messages'

export interface ColorPickerProps {
  label: string
  hint?: string
  value: MemberColor
  onChange: (c: MemberColor) => void
  /** Colors other members already wear (color -> their name). */
  used: Map<MemberColor, string>
  /** List free colors first (new members). */
  freeFirst?: boolean
}

/** Swatch radio group for member identity colors; arrow keys move the selection. */
export function ColorPicker({ label, hint, value, onChange, used, freeFirst }: ColorPickerProps) {
  const t = useT(M)
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const order = freeFirst ? [...MEMBER_COLORS.filter((c) => !used.has(c)), ...MEMBER_COLORS.filter((c) => used.has(c))] : MEMBER_COLORS
  const colorName = (c: MemberColor) => t(`c_${c}` as CoachKey)

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + order.length) % order.length
    onChange(order[next])
    refs.current[next]?.focus()
  }

  return (
    <div className="color-picker">
      <p className="ui-field__label" id={`${id}-label`}>
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} className="color-picker__swatches">
        {order.map((c, i) => {
          const selected = c === value
          const takenBy = used.get(c)
          const name = takenBy ? t('colorInUse', { color: colorName(c) }) : colorName(c)
          return (
            <button
              key={c}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={takenBy ? `${colorName(c)} · ${takenBy}` : colorName(c)}
              tabIndex={selected ? 0 : -1}
              className={cx('color-swatch', selected && 'is-selected', takenBy && 'is-used')}
              style={{ ['--swatch' as string]: memberColorVar(c) }}
              onClick={() => onChange(c)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="color-swatch__dot">{selected ? <Icon name="check" size={16} strokeWidth={2.6} /> : null}</span>
              {takenBy && !selected ? (
                <span className="color-swatch__who" aria-hidden="true">
                  {initials(takenBy).slice(0, 1)}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {hint ? (
        <p className="ui-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
