import { useId, useState, type ComponentPropsWithRef, type ReactNode } from 'react'
import { useT } from '../../i18n'
import { Icon } from '../../ui'
import { AUTH } from './messages'

interface Props extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'onChange' | 'value'> {
  label: ReactNode
  value: string
  onChange: (v: string) => void
  /** Controlled visibility (so two fields can share one toggle); uncontrolled when omitted. */
  shown?: boolean
  onShownChange?: (v: boolean) => void
  /** Hide the eye button (e.g. the confirmation field follows the first one). */
  noToggle?: boolean
  error?: boolean
  describedBy?: string
}

/** Password input with a show/hide eye button (52 px tall, 28 px hit area inside a 44 px button). */
export function PasswordField({ label, value, onChange, shown, onShownChange, noToggle, error, describedBy, id, className, ...rest }: Props) {
  const t = useT(AUTH)
  const auto = useId()
  const inputId = id ?? auto
  const [ownShown, setOwnShown] = useState(false)
  const visible = shown ?? ownShown
  const toggle = () => (onShownChange ? onShownChange(!visible) : setOwnShown(!visible))
  return (
    <div className={['auth-pw', error && 'is-error', className].filter(Boolean).join(' ')}>
      <label className="auth-pw__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="auth-pw__box">
        <input
          {...rest}
          id={inputId}
          className="auth-pw__input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error || undefined}
          aria-describedby={describedBy}
        />
        {noToggle ? null : (
          <button
            type="button"
            className="auth-pw__eye"
            aria-label={visible ? t('hidePassword') : t('showPassword')}
            aria-pressed={visible}
            aria-controls={inputId}
            onClick={toggle}
          >
            <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
          </button>
        )}
      </div>
    </div>
  )
}
