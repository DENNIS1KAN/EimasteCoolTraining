import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { useT } from '../i18n'
import { cx } from './cx'
import { Icon, renderIcon, type IconName } from './Icon'
import { UIM } from './messages'

export interface ChipProps {
  children?: ReactNode
  /** Toggle state (sets aria-pressed when the chip is a button). */
  selected?: boolean
  icon?: IconName | ReactNode
  /** Makes the chip a button (hit area extends to 44 px). */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  /** accent = volt highlighter (e.g. "Aim 57.5 kg"). */
  tone?: 'default' | 'accent'
  /** md 28 px (default), sm 26 px. */
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  style?: CSSProperties
  title?: string
  'aria-label'?: string
}

export function Chip({ children, selected, icon, onClick, tone = 'default', size = 'md', disabled, className, style, title, ...aria }: ChipProps) {
  const cls = cx('ui-chip', `ui-chip--${tone}`, size === 'sm' && 'ui-chip--sm', selected && 'is-selected', onClick && 'ui-chip--button', className)
  const inner = (
    <>
      {renderIcon(icon, 14)}
      {children != null ? <span className="ui-chip__label">{children}</span> : null}
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        aria-pressed={selected === undefined ? undefined : selected}
        disabled={disabled}
        style={style}
        title={title}
        {...aria}
      >
        {inner}
      </button>
    )
  }
  return (
    <span className={cls} style={style} title={title} {...aria}>
      {inner}
    </span>
  )
}

export type TagTone = 'neutral' | 'accent' | 'good' | 'warn' | 'danger' | 'solid'

export interface TagProps {
  children: ReactNode
  tone?: TagTone
  icon?: IconName | ReactNode
  className?: string
  title?: string
}

/** Micro uppercase tag: "LAST SET · FAILURE", "NEXT", "FAIL". */
export function Tag({ children, tone = 'neutral', icon, className, title }: TagProps) {
  return (
    <span className={cx('ui-tag', `ui-tag--${tone}`, className)} title={title}>
      {renderIcon(icon, 11)}
      <span>{children}</span>
    </span>
  )
}

export interface PRBadgeProps {
  /** Default "PR". */
  label?: ReactNode
  /** Play the 1 → 1.08 → 1 pop once (e.g. right after the set is logged). */
  pop?: boolean
  className?: string
}

/** Volt "PR" badge with a trophy. */
export function PRBadge({ label = 'PR', pop, className }: PRBadgeProps) {
  const t = useT(UIM)
  return (
    <span className={cx('ui-pr', pop && 'ui-pr--pop', className)} title={t('personalRecord')}>
      <Icon name="trophy" size={12} strokeWidth={2.2} />
      <span>{label}</span>
    </span>
  )
}
