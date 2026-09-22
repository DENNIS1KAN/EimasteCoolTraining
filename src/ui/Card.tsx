import type { CSSProperties, ElementType, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { cx } from './cx'
import { Icon } from './Icon'

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Element to render (default div; e.g. "section", "article", "li"). Ignored when `to` is set. */
  as?: ElementType
  /** md 16 (default), sm 12, lg 20, none 0. */
  padding?: 'md' | 'sm' | 'lg' | 'none'
  /** Hover/press feedback. Implied by `to` and `onClick`. */
  interactive?: boolean
  /** Makes the whole card a router link. */
  to?: To
  onClick?: (e: MouseEvent<HTMLElement>) => void
  /** Dark "night island" hero surface (both themes), with a glow in `glow` (a CSS color, e.g. memberColorVar(me.color)). */
  night?: boolean
  glow?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export function Card({ as, padding = 'md', interactive, to, onClick, night, glow, className, style, children, ...rest }: CardProps) {
  const isInteractive = interactive || !!to || !!onClick
  const cls = cx(
    'ui-card',
    padding !== 'md' && `ui-card--pad-${padding}`,
    isInteractive && 'ui-card--interactive',
    night && 'night ui-card--night',
    className,
  )
  const st: CSSProperties | undefined = glow ? { ['--card-glow' as string]: glow, ...style } : style
  if (to != null) {
    return (
      <Link to={to} className={cls} style={st} onClick={onClick} {...(rest as HTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    )
  }
  const Comp: ElementType = as ?? 'div'
  if (onClick) {
    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
      rest.onKeyDown?.(e)
      if (e.defaultPrevented || e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick(e as unknown as MouseEvent<HTMLElement>)
      }
    }
    return (
      <Comp role="button" tabIndex={0} {...rest} className={cls} style={st} onClick={onClick} onKeyDown={onKeyDown}>
        {children}
      </Comp>
    )
  }
  return (
    <Comp className={cls} style={st} {...rest}>
      {children}
    </Comp>
  )
}

export interface CardHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  /** Right side: usually a <CardLink/> ("See all ›") or an IconButton. */
  action?: ReactNode
  /** Heading element (default h2). */
  as?: 'h2' | 'h3' | 'h4' | 'p'
  className?: string
}

/** Card section title (Manrope 800 15) with an optional right-hand link. */
export function CardHeader({ title, subtitle, eyebrow, action, as: H = 'h2', className }: CardHeaderProps) {
  return (
    <div className={cx('ui-card-header', className)}>
      <div className="ui-card-header__text">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <H className="ui-card-header__title">{title}</H>
        {subtitle ? <p className="ui-card-header__sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="ui-card-header__action">{action}</div> : null}
    </div>
  )
}

export interface SectionTitleProps {
  title: ReactNode
  eyebrow?: ReactNode
  action?: ReactNode
  as?: 'h2' | 'h3' | 'p'
  className?: string
}

/** A title between cards (outside any card). */
export function SectionTitle({ title, eyebrow, action, as: H = 'h2', className }: SectionTitleProps) {
  return (
    <div className={cx('ui-section-title', className)}>
      <div className="ui-section-title__text">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <H className="ui-section-title__title">{title}</H>
      </div>
      {action ? <div className="ui-section-title__action">{action}</div> : null}
    </div>
  )
}

export interface CardLinkProps {
  to: To
  children: ReactNode
  className?: string
  'aria-label'?: string
}

/** The small "See all ›" link used in card headers (Manrope 700 12, ink-2, 14 px chevron; 44 px hit area). */
export function CardLink({ to, children, className, ...rest }: CardLinkProps) {
  return (
    <Link to={to} className={cx('ui-link', className)} {...rest}>
      <span>{children}</span>
      <Icon name="chevron-right" size={14} strokeWidth={2} />
    </Link>
  )
}
