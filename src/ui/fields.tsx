import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type DragEvent,
  type FocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { getLang, localeOf, useLang, useT, type Lang } from '../i18n'
import { cx } from './cx'
import { Icon, renderIcon, type IconName } from './Icon'
import { UIM } from './messages'

/* ==================================================================== number helpers */

/**
 * Parse a user-typed decimal. Accepts a comma or a dot as the decimal separator (Greek keyboards type a comma),
 * surrounding spaces and a unicode minus. Returns null for empty or invalid input.
 *   parseDecimal('57,5') === 57.5
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  if (input == null) return null
  const s = String(input).replace(/\s+/g, '').replace(/−/g, '-').replace(',', '.')
  if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Validate a partially typed decimal ("57", "57,", "57,5", "-", ","). Returns the cleaned draft, or null when the
 * keystroke should be rejected (letters, a second separator, too many decimals, a minus when negatives are not allowed).
 */
export function sanitizeDecimalDraft(raw: string, decimals: number, allowNegative: boolean): string | null {
  const s = raw.replace(/\s+/g, '').replace(/−/g, '-')
  if (s === '') return ''
  const re = allowNegative ? /^-?\d*([.,]\d*)?$/ : /^\d*([.,]\d*)?$/
  if (!re.test(s)) return null
  const sep = s.search(/[.,]/)
  if (sep >= 0) {
    if (decimals <= 0) return null
    if (s.length - sep - 1 > decimals) return null
  }
  return s
}

/** The canonical string for a draft: dot separator, no dangling separator or lone minus ("57," -> "57", "," -> ""). */
export function canonicalDecimal(draft: string): string {
  let s = draft.replace(',', '.')
  if (s.endsWith('.')) s = s.slice(0, -1)
  if (s === '-' || s === '.' || s === '-.') return ''
  if (s.startsWith('.')) s = '0' + s
  if (s.startsWith('-.')) s = '-0' + s.slice(1)
  return s
}

/**
 * A canonical decimal ("67.5") as the user should see it in an input: the decimal comma in Greek ("67,5"), so a
 * prefilled or copied value matches what the keyboard types and the rest of the UI prints. Storage stays canonical:
 * parseDecimal / canonicalDecimal read either separator back.
 */
export function displayDecimal(canonical: string | number | null | undefined, lang: Lang = getLang()): string {
  if (canonical == null) return ''
  const s = String(canonical)
  return lang === 'el' ? s.replace('.', ',') : s
}

/** Number of decimals in a step (0.1 -> 1, 2.5 -> 1, 0.25 -> 2, 1 -> 0). */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step)) return 0
  const s = String(step)
  if (s.includes('e-')) return Number(s.split('e-')[1]) || 0
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

const roundTo = (n: number, dec: number) => {
  const f = 10 ** dec
  return Math.round((n + Number.EPSILON) * f) / f
}

/* ==================================================================== field shell */

interface ShellProps {
  id: string
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}

function FieldShell({ id, label, hint, error, className, children }: ShellProps) {
  return (
    <div className={cx('ui-field', error ? 'is-invalid' : null, className)}>
      {label != null ? (
        <label className="ui-field__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="ui-field__error" id={`${id}-err`}>
          <Icon name="alert" size={14} />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="ui-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const describedBy = (id: string, hint: unknown, error: unknown, extra?: string) =>
  cx(error ? `${id}-err` : hint ? `${id}-hint` : null, extra) || undefined

/* ==================================================================== TextField */

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Leading icon inside the control. */
  icon?: IconName | ReactNode
  /** Trailing text inside the control (a unit). */
  suffix?: ReactNode
  /** Class for the outer wrapper. */
  fieldClassName?: string
}

export function TextField({ label, hint, error, icon, suffix, id, className, fieldClassName, 'aria-describedby': extraDesc, ...rest }: TextFieldProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={fieldClassName}>
      <div className={cx('ui-control', icon ? 'has-icon' : null)}>
        {icon ? <span className="ui-control__icon">{renderIcon(icon, 18)}</span> : null}
        <input
          id={fid}
          className={cx('ui-control__input', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fid, hint, error, extraDesc)}
          {...rest}
        />
        {suffix != null ? <span className="ui-control__suffix">{suffix}</span> : null}
      </div>
    </FieldShell>
  )
}

/* ==================================================================== NumberField */

export interface NumberFieldProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'size' | 'type' | 'min' | 'max' | 'defaultValue'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** The value as a canonical string ("57.5") or a number. Empty string / null = empty. */
  value: string | number | null | undefined
  /** Receives the canonical string (dot separator): "57,5" typed -> "57.5". "" when cleared. */
  onChange: (value: string) => void
  /** Max decimals accepted (default 1). 0 = integers only. */
  decimals?: number
  min?: number
  max?: number
  /** Unit shown inside the control ("kg"). */
  suffix?: ReactNode
  /** md (form field, default) or lg (52 px set input with a 28 px display numeral, centered). */
  size?: 'md' | 'lg'
  fieldClassName?: string
}

const fmtBound = (n: number, lang: Lang) => new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 3 }).format(n)

/**
 * Decimal input that accepts a comma and uses inputMode="decimal". Values arrive and leave canonical ("57.5"); on
 * screen they use the language's separator ("57,5" in Greek). min/max are validated, never forced: an out-of-range
 * entry stays as typed, is not committed by the blur, and shows a range error (unless the caller passes `error`).
 */
export function NumberField({
  label,
  hint,
  error,
  value,
  onChange,
  decimals = 1,
  min,
  max,
  suffix,
  size = 'md',
  id,
  className,
  fieldClassName,
  onBlur,
  'aria-describedby': extraDesc,
  ...rest
}: NumberFieldProps) {
  const auto = useId()
  const fid = id ?? auto
  const t = useT(UIM)
  const lang = useLang()
  const ext = value == null ? '' : String(value)
  const [draft, setDraft] = useState(() => displayDecimal(ext, lang))
  const [lastExt, setLastExt] = useState(ext)
  const [rangeShown, setRangeShown] = useState(false)
  if (ext !== lastExt) {
    setLastExt(ext)
    if (canonicalDecimal(draft) !== ext) setDraft(displayDecimal(ext, lang))
  }
  const allowNeg = min == null || min < 0
  const parsed = parseDecimal(canonicalDecimal(draft))
  const outOfRange = parsed != null && ((min != null && parsed < min) || (max != null && parsed > max))
  const rangeError =
    rangeShown && outOfRange
      ? min != null && max != null
        ? t('rangeBoth', { min: fmtBound(min, lang), max: fmtBound(max, lang) })
        : min != null
          ? t('rangeMin', { min: fmtBound(min, lang) })
          : t('rangeMax', { max: fmtBound(max!, lang) })
      : null
  const shownError = error ?? rangeError

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = sanitizeDecimalDraft(e.target.value, decimals, allowNeg)
    if (next === null) return
    setDraft(next)
    setRangeShown(false)
    const c = canonicalDecimal(next)
    if (c !== ext) onChange(c)
  }

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (parsed != null && outOfRange) {
      // Keep what was typed (a half-typed "17" must never become a stored 100) and say what's allowed.
      setRangeShown(true)
    } else if (parsed != null) {
      const out = String(roundTo(parsed, decimals))
      const shown = draft.includes(',') || lang === 'el' ? out.replace('.', ',') : out
      if (shown !== draft) setDraft(shown)
      if (out !== ext) onChange(out)
    } else if (draft !== '' && canonicalDecimal(draft) === '') {
      setDraft('')
    }
    onBlur?.(e)
  }

  return (
    <FieldShell id={fid} label={label} hint={hint} error={shownError} className={cx(size === 'lg' && 'ui-field--lg', fieldClassName)}>
      <div className={cx('ui-control', size === 'lg' && 'ui-control--lg')}>
        <input
          id={fid}
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          spellCheck={false}
          className={cx('ui-control__input', 'ui-control__input--num', className)}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={describedBy(fid, hint, shownError, extraDesc)}
          value={draft}
          onChange={handleChange}
          onBlur={handleBlur}
          {...rest}
        />
        {suffix != null ? <span className="ui-control__suffix">{suffix}</span> : null}
      </div>
    </FieldShell>
  )
}

/* ==================================================================== TextArea */

export interface TextAreaProps extends ComponentPropsWithRef<'textarea'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  fieldClassName?: string
}

export function TextArea({ label, hint, error, rows = 3, id, className, fieldClassName, 'aria-describedby': extraDesc, ...rest }: TextAreaProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={fieldClassName}>
      <div className="ui-control ui-control--area">
        <textarea
          id={fid}
          rows={rows}
          className={cx('ui-control__input', className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fid, hint, error, extraDesc)}
          {...rest}
        />
      </div>
    </FieldShell>
  )
}

/* ==================================================================== Select */

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SelectProps<T extends string = string> {
  label?: ReactNode
  options: SelectOption<T>[]
  value: T
  onChange: (value: T) => void
  hint?: ReactNode
  error?: ReactNode
  disabled?: boolean
  id?: string
  name?: string
  icon?: IconName | ReactNode
  className?: string
  'aria-label'?: string
}

/** Native <select> (best on phones) styled like the other controls. */
export function Select<T extends string = string>({ label, options, value, onChange, hint, error, disabled, id, name, icon, className, ...aria }: SelectProps<T>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <div className={cx('ui-control', 'ui-control--select', icon ? 'has-icon' : null)}>
        {icon ? <span className="ui-control__icon">{renderIcon(icon, 18)}</span> : null}
        <select
          id={fid}
          name={name}
          className="ui-control__input"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fid, hint, error)}
          onChange={(e) => onChange(e.target.value as T)}
          {...aria}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="ui-control__chev" aria-hidden="true">
          <Icon name="chevron-down" size={18} />
        </span>
      </div>
    </FieldShell>
  )
}

/* ==================================================================== Switch */

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
}

/** A full-width row (44 px+) with the label on the left and the toggle on the right. The whole row toggles. */
export function Switch({ checked, onChange, label, description, disabled, id, className }: SwitchProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <button
      type="button"
      role="switch"
      id={fid}
      aria-checked={checked}
      aria-labelledby={`${fid}-l`}
      aria-describedby={description ? `${fid}-d` : undefined}
      disabled={disabled}
      className={cx('ui-switch', checked && 'is-on', className)}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch__text">
        <span className="ui-switch__label" id={`${fid}-l`}>
          {label}
        </span>
        {description ? (
          <span className="ui-switch__desc" id={`${fid}-d`}>
            {description}
          </span>
        ) : null}
      </span>
      <span className="ui-switch__track" aria-hidden="true">
        <span className="ui-switch__knob" />
      </span>
    </button>
  )
}

/* ==================================================================== Stepper */

export interface StepperProps {
  value: number
  onChange: (value: number) => void
  /** Default 0.1. The value is rounded to the step's decimals (0.1 -> 1 decimal). */
  step?: number
  min?: number
  max?: number
  /** Display format (default n.toFixed(decimals of step)). */
  format?: (n: number) => string
  unit?: ReactNode
  /** md: 44 px buttons (default), lg: 52 px buttons and a 40 px numeral. */
  size?: 'md' | 'lg'
  /** Accessible name of the value ("Body weight"). */
  label?: string
  disabled?: boolean
  className?: string
}

/** Press-and-hold repeat for the −/+ buttons; stops as soon as a step changes nothing (limit reached). */
function useHold(action: () => boolean) {
  const timeout = useRef<number | undefined>(undefined)
  const interval = useRef<number | undefined>(undefined)
  const repeated = useRef(false)
  const actionRef = useRef(action)
  useEffect(() => {
    actionRef.current = action
  })
  const stop = () => {
    window.clearTimeout(timeout.current)
    window.clearInterval(interval.current)
    timeout.current = interval.current = undefined
  }
  useEffect(() => stop, [])
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      repeated.current = false
      stop()
      timeout.current = window.setTimeout(() => {
        repeated.current = true
        if (!actionRef.current()) return stop()
        interval.current = window.setInterval(() => {
          if (!actionRef.current()) stop()
        }, 75)
      }, 420)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    onClick: () => {
      if (repeated.current) {
        repeated.current = false
        return
      }
      actionRef.current()
    },
  }
}

/** Big −/+ control for logging a number (body weight). The value is also typeable (comma accepted). */
export function Stepper({
  value,
  onChange,
  step = 0.1,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  format,
  unit,
  size = 'md',
  label,
  disabled,
  className,
}: StepperProps) {
  const t = useT(UIM)
  const dec = decimalsOf(step)
  const fmt = format ?? ((n: number) => n.toFixed(dec))
  const [draft, setDraft] = useState<string | null>(null)
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  }, [value])

  const commit = (n: number): number => {
    const v = Math.min(max, Math.max(min, roundTo(n, dec)))
    if (v !== valueRef.current) {
      valueRef.current = v
      onChange(v)
    }
    return v
  }
  const bump = (dir: 1 | -1, mult = 1): boolean => {
    const before = valueRef.current
    return commit(before + dir * step * mult) !== before
  }
  const dec1 = useHold(() => bump(-1))
  const inc1 = useHold(() => bump(1))

  const commitDraft = (): number | null => {
    if (draft == null) return null
    const n = parseDecimal(draft)
    return n == null ? null : commit(n)
  }

  const shown = draft ?? fmt(value)
  const atMin = value <= min
  const atMax = value >= max
  return (
    <div className={cx('ui-stepper', `ui-stepper--${size}`, disabled && 'is-disabled', className)} role="group" aria-label={label}>
      <button type="button" className="ui-stepper__btn" aria-label={t('decrease')} disabled={disabled || atMin} {...dec1}>
        <Icon name="minus" size={size === 'lg' ? 24 : 22} />
      </button>
      <label className="ui-stepper__value">
        <input
          className="ui-stepper__input"
          type="text"
          role="spinbutton"
          inputMode={dec > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuetext={typeof unit === 'string' ? `${fmt(value)} ${unit}` : fmt(value)}
          disabled={disabled}
          size={Math.max(2, shown.length)}
          value={shown}
          onFocus={(e) => {
            setDraft(fmt(value))
            const el = e.currentTarget
            requestAnimationFrame(() => el.select())
          }}
          onChange={(e) => {
            const s = sanitizeDecimalDraft(e.target.value, dec, min < 0)
            if (s !== null) setDraft(s)
          }}
          onBlur={() => {
            commitDraft()
            setDraft(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const v = commitDraft()
              setDraft(fmt(v ?? valueRef.current))
            } else if (e.key === 'Escape') {
              if (draft != null && draft !== fmt(value)) {
                e.stopPropagation()
                setDraft(fmt(value))
              }
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') {
              e.preventDefault()
              const base = (draft != null ? parseDecimal(draft) : null) ?? valueRef.current
              const dir = e.key === 'ArrowUp' || e.key === 'PageUp' ? 1 : -1
              const mult = e.key.startsWith('Page') ? 10 : 1
              const v = commit(base + dir * step * mult)
              setDraft(fmt(v))
            }
          }}
        />
        {unit != null ? <span className="ui-stepper__unit">{unit}</span> : null}
      </label>
      <button type="button" className="ui-stepper__btn" aria-label={t('increase')} disabled={disabled || atMax} {...inc1}>
        <Icon name="plus" size={size === 'lg' ? 24 : 22} />
      </button>
    </div>
  )
}

/* ==================================================================== DateField */

export interface DateFieldProps {
  label?: ReactNode
  /** YYYY-MM-DD */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  hint?: ReactNode
  error?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
  required?: boolean
}

export function DateField({ label, value, onChange, min, max, hint, error, disabled, id, className, required }: DateFieldProps) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell id={fid} label={label} hint={hint} error={error} className={className}>
      <div className="ui-control ui-control--date has-icon">
        <span className="ui-control__icon">
          <Icon name="calendar" size={18} />
        </span>
        <input
          id={fid}
          type="date"
          className="ui-control__input"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fid, hint, error)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </FieldShell>
  )
}

/* ==================================================================== FileDrop */

/** Does a file match an `accept` string ("application/pdf,image/*,.csv")? */
export function matchesAccept(file: { name: string; type: string }, accept?: string): boolean {
  if (!accept) return true
  const name = file.name.toLowerCase()
  const mime = (file.type || '').toLowerCase()
  return accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .some((a) => (a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? mime.startsWith(a.slice(0, -1)) : mime === a))
}

export interface FileDropProps {
  accept?: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  label: ReactNode
  hint?: ReactNode
  icon?: IconName | ReactNode
  disabled?: boolean
  /** Button text (default "Choose file"). */
  buttonLabel?: ReactNode
  className?: string
}

/** Dashed drop zone with a "Choose file" button. Dropped files are filtered by `accept`. */
export function FileDrop({ accept, multiple, onFiles, label, hint, icon = 'upload', disabled, buttonLabel, className }: FileDropProps) {
  const t = useT(UIM)
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const labelId = useId()

  const deliver = (list: FileList | null) => {
    if (!list || disabled) return
    let files = Array.from(list).filter((f) => matchesAccept(f, accept))
    if (!multiple) files = files.slice(0, 1)
    if (files.length) onFiles(files)
  }
  const onDragEnter = (e: DragEvent) => {
    if (disabled) return
    e.preventDefault()
    depth.current++
    setOver(true)
  }
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault()
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setOver(false)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    depth.current = 0
    setOver(false)
    deliver(e.dataTransfer?.files ?? null)
  }

  return (
    <div
      className={cx('ui-filedrop', over && 'is-over', disabled && 'is-disabled', className)}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (!disabled) e.preventDefault()
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={(e) => {
        if (disabled || (e.target as HTMLElement).closest('button')) return
        inputRef.current?.click()
      }}
    >
      <span className="ui-filedrop__icon" aria-hidden="true">
        {renderIcon(icon, 22)}
      </span>
      <div className="ui-filedrop__text">
        <p className="ui-filedrop__label" id={labelId}>
          {label}
        </p>
        {hint ? <p className="ui-filedrop__hint">{hint}</p> : null}
        <button
          type="button"
          className="ui-btn ui-btn--secondary ui-btn--sm ui-filedrop__btn"
          disabled={disabled}
          aria-describedby={labelId}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="upload" size={16} />
          <span className="ui-btn__label">{buttonLabel ?? (multiple ? t('chooseFiles') : t('chooseFile'))}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        tabIndex={-1}
        onChange={(e) => {
          deliver(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
