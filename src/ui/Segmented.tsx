import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'
import { renderIcon, type IconName } from './Icon'

export interface SegmentOption<T extends string | number = string> {
  value: T
  label: ReactNode
  /** Small uppercase sub-label under the label (size "lg" day tabs: "✓ STR", "HYP · NOW"). */
  sub?: ReactNode
  icon?: IconName | ReactNode
  disabled?: boolean
  /** Accessible name when the label is an icon or abbreviated. */
  ariaLabel?: string
}

export interface SegmentedProps<T extends string | number = string> {
  options: SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** md 44 (default), sm 36 (range tabs), lg 46 (day tabs with a sub-label). */
  size?: 'sm' | 'md' | 'lg'
  ariaLabel?: string
  /** Stretch to the container width. */
  block?: boolean
  className?: string
  style?: CSSProperties
  /** "radio" (default: a radiogroup) or "tabs" (tablist/tab, for page-level tabs). */
  mode?: 'radio' | 'tabs'
  /** tabs mode: id of the tabpanel each tab controls. */
  controls?: (value: T) => string | undefined
  /** tabs mode: id for each tab (so panels can use aria-labelledby). */
  tabId?: (value: T) => string | undefined
}

/**
 * Segmented control. Arrow keys move the selection (roving tabindex), Home/End jump to the ends.
 * The selected segment is a sliding `--seg-on` thumb.
 */
export function Segmented<T extends string | number = string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
  block,
  className,
  style,
  mode = 'radio',
  controls,
  tabId,
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = options.findIndex((o) => o.value === value)
  const focusIndex = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : options.findIndex((o) => !o.disabled)
  const tabs = mode === 'tabs'

  const move = (from: number, delta: 1 | -1 | 'first' | 'last') => {
    const n = options.length
    if (!n) return
    let i: number
    if (delta === 'first' || delta === 'last') {
      i = delta === 'first' ? 0 : n - 1
      const step = delta === 'first' ? 1 : -1
      for (let k = 0; k < n && options[i]?.disabled; k++) i = (i + step + n) % n
    } else {
      i = from
      for (let k = 0; k < n; k++) {
        i = (i + delta + n) % n
        if (!options[i].disabled) break
      }
    }
    if (options[i]?.disabled) return
    refs.current[i]?.focus()
    if (options[i].value !== value) onChange(options[i].value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        move(i, 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        move(i, -1)
        break
      case 'Home':
        e.preventDefault()
        move(i, 'first')
        break
      case 'End':
        e.preventDefault()
        move(i, 'last')
        break
    }
  }

  return (
    <div
      role={tabs ? 'tablist' : 'radiogroup'}
      aria-label={ariaLabel}
      className={cx('ui-seg', `ui-seg--${size}`, block && 'ui-seg--block', className)}
      style={{ ['--n' as string]: options.length, ['--i' as string]: Math.max(0, selectedIndex), ...style }}
    >
      {selectedIndex >= 0 ? <span className="ui-seg__thumb" aria-hidden="true" /> : null}
      {options.map((o, i) => {
        const on = i === selectedIndex
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role={tabs ? 'tab' : 'radio'}
            id={tabs ? tabId?.(o.value) : undefined}
            aria-controls={tabs ? controls?.(o.value) : undefined}
            aria-selected={tabs ? on : undefined}
            aria-checked={tabs ? undefined : on}
            aria-label={o.ariaLabel}
            tabIndex={i === focusIndex ? 0 : -1}
            disabled={o.disabled}
            className={cx('ui-seg__item', on && 'is-on')}
            onClick={() => {
              if (!on) onChange(o.value)
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span className="ui-seg__main">
              {renderIcon(o.icon, size === 'sm' ? 14 : 16)}
              {o.label != null ? <span className="ui-seg__label">{o.label}</span> : null}
            </span>
            {o.sub != null ? <span className="ui-seg__sub">{o.sub}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Page-level tabs: a Segmented control with tablist/tab semantics. */
export function Tabs<T extends string | number = string>(props: Omit<SegmentedProps<T>, 'mode'>) {
  return <Segmented {...props} mode="tabs" />
}
