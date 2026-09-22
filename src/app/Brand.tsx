import { useId } from 'react'
import './AppShell.css'

/*
 * Brand: the "EC" monogram (Sofia Sans Extra Condensed Black Italic outlines: volt E, white C) on the
 * Night Session gradient, plus the "EIMASTE COOL / TRAINING" wordmark.
 * The same outlines are used by scripts/make-icons.mjs for the PWA icons; keep them in sync.
 */

/** Glyph outlines in a 64x64 box (cap height 32, centred). */
export const MARK_E =
  'M12.32 47.71Q11.58 47.71 11.71 47.04L16.51 16.96Q16.65 16.29 17.19 16.29H31.55Q32.26 16.29 32.13 16.96L31.35 21.9Q31.25 22.56 30.68 22.56H22.53L21.55 28.88H28.79Q29.5 28.88 29.37 29.54L28.64 34.19Q28.54 34.85 27.97 34.85H20.6L19.56 41.44H27.55Q28.26 41.44 28.16 42.11L27.35 47.04Q27.27 47.71 26.68 47.71Z'
export const MARK_C =
  'M39.63 48Q34.7 48 32.41 45.03Q30.13 42.06 31.01 36.37L32.54 26.71Q33.42 21.21 36.08 18.6Q38.74 16 43.55 16Q46.86 16 48.99 17.41Q51.13 18.81 51.92 21.36Q52.71 23.9 51.91 27.39Q51.78 28.05 51.24 28.05H45.57Q44.87 28.05 45 27.39Q45.5 25.02 45.03 23.69Q44.57 22.35 42.87 22.35Q41.31 22.35 40.55 23.41Q39.79 24.47 39.38 26.99L37.85 36.55Q37.44 39.2 38.01 40.42Q38.58 41.65 40.25 41.65Q41.96 41.65 42.66 40.24Q43.37 38.84 43.56 36.58Q43.64 35.91 44.23 35.91H49.89Q50.2 35.91 50.38 36.08Q50.55 36.25 50.51 36.58Q50.19 41.8 47.55 44.9Q44.91 48 39.63 48Z'

export const BRAND_NAME = 'Eimaste Cool Training'

export interface BrandMarkProps {
  /** Rendered size in px (square). */
  size?: number
  /** Accessible name. Omit for a decorative mark (aria-hidden). */
  title?: string
  /** 'tile' (default): monogram on the dark rounded tile. 'glyph': letters only (volt E + currentColor C). */
  variant?: 'tile' | 'glyph'
  className?: string
}

/** The app mark. The tile variant is intentionally dark in both themes (like the `.night` hero card). */
export function BrandMark({ size = 40, title, variant = 'tile', className }: BrandMarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  const cls = ['brand-mark', variant === 'glyph' ? 'brand-mark--glyph' : '', className].filter(Boolean).join(' ')

  if (variant === 'glyph') {
    return (
      <svg className={cls} width={size} height={size} viewBox="8 12 48 40" focusable="false" {...a11y}>
        <path fill="var(--brand-volt, #D4FF3F)" d={MARK_E} />
        <path fill="currentColor" d={MARK_C} />
      </svg>
    )
  }
  const bg = `${uid}-bg`
  const gb = `${uid}-gb`
  const gv = `${uid}-gv`
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 64 64" focusable="false" {...a11y}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#18202F" />
          <stop offset=".55" stopColor="#0C1019" />
          <stop offset="1" stopColor="#07090F" />
        </linearGradient>
        <radialGradient id={gb} cx="1" cy="0" r=".75">
          <stop offset="0" stopColor="#3987E5" stopOpacity=".28" />
          <stop offset="1" stopColor="#3987E5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gv} cx="0" cy="1" r=".7">
          <stop offset="0" stopColor="#D4FF3F" stopOpacity=".14" />
          <stop offset="1" stopColor="#D4FF3F" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${bg})`} />
      <rect width="64" height="64" rx="15" fill={`url(#${gb})`} />
      <rect width="64" height="64" rx="15" fill={`url(#${gv})`} />
      <rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="none" stroke="#FFFFFF" strokeOpacity=".08" />
      <path fill="#D4FF3F" d={MARK_E} />
      <path fill="#F3F6FB" d={MARK_C} />
    </svg>
  )
}

export interface WordmarkProps {
  /** 'stacked': EIMASTE COOL over a tracked TRAINING line. 'inline': one line. */
  layout?: 'stacked' | 'inline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/** "EIMASTE COOL" in the display face with a lighter "TRAINING". Text follows the ink tokens. */
export function Wordmark({ layout = 'stacked', size = 'md', className }: WordmarkProps) {
  const cls = ['wordmark', `wordmark--${layout}`, `wordmark--${size}`, className].filter(Boolean).join(' ')
  return (
    <span className={cls}>
      <span className="wordmark__main">Eimaste Cool</span>
      {layout === 'inline' ? ' ' : null}
      <span className="wordmark__sub">Training</span>
    </span>
  )
}

export interface BrandProps {
  size?: 'sm' | 'md' | 'lg'
  layout?: 'stacked' | 'inline'
  /** Show the monogram tile before the wordmark (default true). */
  mark?: boolean
  className?: string
}

const MARK_PX = { sm: 32, md: 40, lg: 56 } as const

/** Mark + wordmark lockup (sidebar, login, boot). Exposes the product name to assistive tech once. */
export function Brand({ size = 'md', layout = 'stacked', mark = true, className }: BrandProps) {
  return (
    <span className={['brand', `brand--${size}`, className].filter(Boolean).join(' ')}>
      {mark && <BrandMark size={MARK_PX[size]} />}
      <Wordmark layout={layout} size={size} />
    </span>
  )
}
