import type { ReactNode } from 'react'
import { useT } from '../../i18n'
import { Icon } from '../../ui'
import { AUTH } from './messages'
import type { PasswordCheck } from './password'
import './fields.css'

/** Live checklist under a new-password form: "At least 6 characters", "Both match". */
export function PasswordRules({ id, check }: { id: string; check: PasswordCheck }) {
  const t = useT(AUTH)
  const rows: [boolean, string][] = [
    [check.longEnough, t('ruleLength')],
    [check.matches, t('ruleMatch')],
  ]
  return (
    <ul id={id} className="join-rules">
      {rows.map(([ok, label]) => (
        <li key={label} className={ok ? 'is-ok' : undefined}>
          <span className="join-rules__tick" aria-hidden="true">
            <Icon name="check" size={12} strokeWidth={2.6} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}

/** Inline form error (danger-soft band with an alert icon), announced to screen readers. */
export function FormError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="auth-error" role="alert">
      <Icon name="alert" size={16} />
      <span>{children}</span>
    </p>
  )
}
