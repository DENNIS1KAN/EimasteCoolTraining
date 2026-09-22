import type { CSSProperties, ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { useT } from '../i18n'
import { cx } from './cx'
import { Icon, renderIcon, type IconName } from './Icon'
import { UIM } from './messages'

/* ------------------------------------------------------------------ Delta */

export type DeltaDir = 'down' | 'up' | 'flat'
export type DeltaTone = 'good' | 'warn' | 'neutral' | 'danger'

export interface DeltaProps {
  text: ReactNode
  dir: DeltaDir
  tone?: DeltaTone
  className?: string
}

/** Arrow pill: status color + arrow icon + value (never color alone). */
export function Delta({ text, dir, tone = 'neutral', className }: DeltaProps) {
  const t = useT(UIM)
  const icon: IconName = dir === 'down' ? 'arrow-down' : dir === 'up' ? 'arrow-up' : 'minus'
  const sr = dir === 'down' ? t('down') : dir === 'up' ? t('up') : t('noChange')
  return (
    <span className={cx('ui-delta', `ui-delta--${tone}`, className)}>
      <Icon name={icon} size={12} strokeWidth={2.4} />
      <span className="visually-hidden">{sr} </span>
      <span>{text}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ BigNumber */

export type BigNumberSize = 'xxl' | 'xl' | 'lg' | 'md' | 'sm'

export interface BigNumberProps {
  value: ReactNode
  unit?: ReactNode
  /** xxl 100 (body weight), xl 72, lg 56 (score), md 34 (metric), sm 24. */
  size?: BigNumberSize
  className?: string
  style?: CSSProperties
}

/** Display numerals (Sofia Sans Extra Condensed, tabular lining) with a small unit in ink-2. */
export function BigNumber({ value, unit, size = 'md', className, style }: BigNumberProps) {
  return (
    <span className={cx('ui-bignum', `ui-bignum--${size}`, className)} style={style}>
      {value}
      {unit != null && unit !== '' ? <small className="ui-bignum__unit">{unit}</small> : null}
    </span>
  )
}

/* ------------------------------------------------------------------ StatTile */

export interface StatTileProps {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  icon?: IconName | ReactNode
  delta?: DeltaProps
  /** A small chart under the value, e.g. <Sparkline/>. */
  trend?: ReactNode
  /** A caption under the label (11 px, muted). */
  sub?: ReactNode
  /** Makes the tile a router link. */
  to?: To
  className?: string
  style?: CSSProperties
}

/** Radius-18 tile: 16 px icon top-right, Stat numeral (+ unit), label. Three-up grid (.grid-3), gap 10. */
export function StatTile({ label, value, unit, icon, delta, trend, sub, to, className, style }: StatTileProps) {
  const body = (
    <>
      {icon ? <span className="ui-tile__icon">{renderIcon(icon, 16)}</span> : null}
      <p className="ui-tile__value">
        {value}
        {unit != null && unit !== '' ? <small>{unit}</small> : null}
      </p>
      <p className="ui-tile__label">{label}</p>
      {sub ? <p className="ui-tile__sub">{sub}</p> : null}
      {delta || trend ? (
        <div className="ui-tile__foot">
          {delta ? <Delta {...delta} /> : null}
          {trend ? <div className="ui-tile__trend">{trend}</div> : null}
        </div>
      ) : null}
    </>
  )
  const cls = cx('ui-tile', icon ? 'ui-tile--icon' : null, to != null && 'ui-tile--link', className)
  return to != null ? (
    <Link to={to} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  )
}
