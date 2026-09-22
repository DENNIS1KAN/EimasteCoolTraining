import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { useT } from '../i18n'
import { cx } from './cx'
import { renderIcon, type IconName } from './Icon'
import { Spinner } from './feedback'
import { UIM } from './messages'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'tonal' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonLook {
  /** primary = volt fill (one per screen), secondary = surface-2, ghost = outline, tonal = surface-3, danger = destructive. */
  variant?: ButtonVariant
  /** sm 40 px, md 48 px (default), lg 52 px. */
  size?: ButtonSize
  /** Leading icon: an icon name or any node. */
  icon?: IconName | ReactNode
  /** Trailing icon (e.g. 'arrow-right', 'chevron-right'). */
  iconRight?: IconName | ReactNode
  /** Full width. */
  block?: boolean
}

const ICON_PX: Record<ButtonSize, number> = { sm: 18, md: 20, lg: 22 }

function buttonClass(variant: ButtonVariant, size: ButtonSize, block: boolean | undefined, className?: string) {
  return cx('ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block', className)
}

export interface ButtonProps extends ButtonLook, ComponentPropsWithRef<'button'> {
  /** Shows a spinner in place of the leading icon, sets aria-busy and blocks clicks. */
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  block,
  className,
  children,
  type = 'button',
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const px = ICON_PX[size]
  return (
    <button
      type={type}
      className={buttonClass(variant, size, block, cx(loading && 'is-loading', className))}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {loading ? <Spinner size={px - 2} decorative /> : renderIcon(icon, px)}
      {children != null && children !== false ? <span className="ui-btn__label">{children}</span> : null}
      {renderIcon(iconRight, px)}
    </button>
  )
}

export interface ButtonLinkProps extends ButtonLook, Omit<LinkProps, 'className'> {
  className?: string
}

/** A react-router <Link> styled as a button. */
export function ButtonLink({ variant = 'primary', size = 'md', icon, iconRight, block, className, children, ...rest }: ButtonLinkProps) {
  const px = ICON_PX[size]
  return (
    <Link className={buttonClass(variant, size, block, className)} {...rest}>
      {renderIcon(icon, px)}
      {children != null && children !== false ? <span className="ui-btn__label">{children}</span> : null}
      {renderIcon(iconRight, px)}
    </Link>
  )
}

export type IconButtonVariant = 'soft' | 'ghost' | 'outline' | 'accent'

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconName | ReactNode
  /** Accessible name (required: icon-only buttons need one). */
  label: string
  /** soft = surface-2 (default), ghost = transparent, outline = 1.5px ring, accent = volt fill. */
  variant?: IconButtonVariant
  /** Hit target in px: 44 (default) or 36 (dense; the hit area still reaches 44). */
  size?: 44 | 36 | 40 | 48 | 52
  /** Unread dot (true) or a count. */
  badge?: boolean | number
  iconSize?: number
}

export function IconButton({
  icon,
  label,
  variant = 'soft',
  size = 44,
  badge,
  iconSize,
  className,
  type = 'button',
  style,
  ...rest
}: IconButtonProps) {
  const t = useT(UIM)
  const count = typeof badge === 'number' ? badge : 0
  const showBadge = badge === true || count > 0
  const name = showBadge ? `${label}, ${count > 0 ? t('unread', { n: count }) : t('newItems')}` : label
  return (
    <button
      type={type}
      className={cx('ui-iconbtn', `ui-iconbtn--${variant}`, size < 44 && 'ui-iconbtn--dense', className)}
      aria-label={name}
      style={{ ['--ib-size' as string]: `${size}px`, ...style }}
      {...rest}
    >
      {renderIcon(icon, iconSize ?? (size <= 36 ? 18 : 20))}
      {showBadge ? (
        <span className={cx('ui-badge', count > 0 && 'ui-badge--count')} aria-hidden="true">
          {count > 0 ? (count > 99 ? '99+' : count) : null}
        </span>
      ) : null}
    </button>
  )
}
