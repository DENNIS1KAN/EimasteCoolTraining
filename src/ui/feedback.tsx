import type { CSSProperties, ReactNode } from 'react'
import { useT } from '../i18n'
import { cx } from './cx'
import { Icon, renderIcon, type IconName } from './Icon'
import { UIM } from './messages'

/* ------------------------------------------------------------------ Spinner */

export interface SpinnerProps {
  size?: number
  /** Accessible label (default "Loading"). */
  label?: string
  /** Hide from assistive tech (e.g. inside a button that already sets aria-busy). */
  decorative?: boolean
  className?: string
}

export function Spinner({ size = 20, label, decorative, className }: SpinnerProps) {
  const t = useT(UIM)
  const sw = size <= 16 ? 2.6 : 2.2
  return (
    <span
      className={cx('ui-spinner', className)}
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : (label ?? t('loading'))}
      aria-hidden={decorative || undefined}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" strokeWidth={sw} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" stroke="currentColor" opacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" />
      </svg>
    </span>
  )
}

/* ------------------------------------------------------------------ Skeleton */

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: number | string
  className?: string
  style?: CSSProperties
}

export function Skeleton({ width = '100%', height = 14, radius = 8, className, style }: SkeletonProps) {
  return <span className={cx('ui-skeleton', className)} aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />
}

/* ------------------------------------------------------------------ ProgressBar */

export interface ProgressBarProps {
  /** 0..1 (clamped). */
  value: number
  /** Fill color (default accent-strong: volt in dark, ink in light). Pass a member color for identity. */
  color?: string
  height?: number
  /** Accessible label; also exposes role="progressbar". */
  label?: string
  /** Optional visible value text, e.g. "124 / 180 g" (for aria-valuetext). */
  valueText?: string
  className?: string
  style?: CSSProperties
}

export function ProgressBar({ value, color, height = 6, label, valueText, className, style }: ProgressBarProps) {
  const v = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  return (
    <div
      className={cx('ui-progress', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={valueText}
      style={{ height, borderRadius: height / 2, ...style }}
    >
      <span className="ui-progress__fill" style={{ width: `${v * 100}%`, background: color, borderRadius: height / 2 }} />
    </div>
  )
}

/* ------------------------------------------------------------------ WeekDots */

export type WeekDotState = 'done' | 'today' | 'upcoming' | 'missed'
export interface WeekDotItem {
  /** One letter: U, L, P… */
  label: string
  state: WeekDotState
  /** Full name for assistive tech and the tooltip, e.g. "Upper". */
  title?: string
}
export interface WeekDotsProps {
  items: WeekDotItem[]
  size?: number
  /** Accessible summary, e.g. "This week: 2 of 5 done". */
  label?: string
  className?: string
}

export function WeekDots({ items, size = 23, label, className }: WeekDotsProps) {
  const t = useT(UIM)
  const stateText: Record<WeekDotState, string> = { done: t('done'), today: t('today'), upcoming: t('upcoming'), missed: t('missed') }
  return (
    <ol className={cx('ui-weekdots', className)} aria-label={label} style={{ ['--wd-size' as string]: `${size}px` }}>
      {items.map((it, i) => {
        const name = `${it.title ?? it.label}: ${stateText[it.state]}`
        return (
          <li key={i} className={`ui-weekdots__dot is-${it.state}`} title={name} aria-label={name}>
            <span aria-hidden="true">{it.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ EmptyState */

export interface EmptyStateProps {
  icon?: IconName | ReactNode
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  /** Tighter padding for use inside a card. */
  compact?: boolean
  className?: string
}

export function EmptyState({ icon = 'sparkles', title, body, action, compact, className }: EmptyStateProps) {
  return (
    <div className={cx('ui-empty', compact && 'ui-empty--compact', className)}>
      <div className="ui-empty__icon" aria-hidden="true">
        {renderIcon(icon, 24)}
      </div>
      <p className="ui-empty__title">{title}</p>
      {body ? <p className="ui-empty__body">{body}</p> : null}
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ Banner */

export type BannerTone = 'info' | 'warn' | 'danger' | 'accent' | 'good'
const BANNER_ICON: Record<BannerTone, IconName> = { info: 'info', warn: 'alert', danger: 'alert', accent: 'sparkles', good: 'check-circle' }

export interface BannerProps {
  tone?: BannerTone
  /** Icon name or node; `false` hides it. Defaults to a tone icon. */
  icon?: IconName | ReactNode | false
  title?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
  children?: ReactNode
  className?: string
  role?: 'status' | 'alert'
}

export function Banner({ tone = 'info', icon, title, action, onDismiss, children, className, role }: BannerProps) {
  const t = useT(UIM)
  const ic = icon === false ? null : renderIcon(icon ?? BANNER_ICON[tone], 18)
  return (
    <div className={cx('ui-banner', `ui-banner--${tone}`, className)} role={role}>
      {ic ? <span className="ui-banner__icon">{ic}</span> : null}
      <div className="ui-banner__text">
        {title ? <p className="ui-banner__title">{title}</p> : null}
        {children ? <div className="ui-banner__body">{children}</div> : null}
      </div>
      {action ? <div className="ui-banner__action">{action}</div> : null}
      {onDismiss ? (
        <button type="button" className="ui-banner__close" aria-label={t('dismiss')} onClick={onDismiss}>
          <Icon name="x" size={16} />
        </button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ LiveDot */

/** The 7 px "live" dot (volt with a glow on night surfaces, ink on light surfaces). */
export function LiveDot({ pulse, className }: { pulse?: boolean; className?: string }) {
  return <i className={cx('ui-live-dot', pulse && 'ui-live-dot--pulse', className)} aria-hidden="true" />
}
