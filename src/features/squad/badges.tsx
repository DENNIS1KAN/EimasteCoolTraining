import { useId, useMemo, type CSSProperties } from 'react'
import { translate } from '../../i18n'
import { BADGES, type BadgeId, type BadgeTier } from '../../lib/stats'
import { Icon, type IconName } from '../../ui'
import { BADGE_M } from './badgeMessages'
import './squad.css'

/** Glyph per badge (from the app icon set; never emoji). */
export const BADGE_ICON: Record<BadgeId, IconName> = {
  'first-workout': 'train',
  'workouts-10': 'repeat',
  'workouts-25': 'fist',
  halfway: 'chart',
  'program-complete': 'crown',
  'perfect-week': 'calendar-check',
  'streak-4': 'flame',
  'first-pr': 'trophy',
  'prs-10': 'star',
  'prs-25': 'sparkles',
  'ten-tonnes': 'dumbbell-plate',
  'early-bird': 'sun',
  'night-owl': 'moon',
  'weigh-in-7': 'scale',
  'on-plan-7': 'fuel',
  'goal-reached': 'target',
  'hype-squad': 'heart',
}

export const BADGE_TIER: Record<BadgeId, BadgeTier> = Object.fromEntries(BADGES.map((b) => [b.id, b.tier])) as Record<BadgeId, BadgeTier>

export interface BadgeText {
  title: string
  description: string
  tier: string
}

/** Title, criterion and tier name for every badge, in the current language. */
export function useBadgeText(): Record<BadgeId, BadgeText> {
  return useMemo(() => {
    const out = {} as Record<BadgeId, BadgeText>
    for (const b of BADGES) {
      out[b.id] = {
        title: translate(BADGE_M, `title_${b.id}` as keyof typeof BADGE_M.en, undefined),
        description: translate(BADGE_M, `desc_${b.id}` as keyof typeof BADGE_M.en, undefined),
        tier: translate(BADGE_M, `tier_${b.tier}`, undefined),
      }
    }
    return out
  }, [])
}

/** 16 scallops around a disc: a rosette outline in viewBox 0 0 48 48. */
const SCALLOPS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2
  return { cx: 24 + Math.cos(a) * 19.4, cy: 24 + Math.sin(a) * 19.4 }
})

export interface BadgeMedalProps {
  id: BadgeId
  earned?: boolean
  /** Diameter in px (default 48). */
  size?: number
  /** Hide from assistive tech when the title is printed next to it. */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/** Tiered medal (bronze / silver / gold rosette) with the badge's glyph; locked badges are dimmed with a lock. */
export function BadgeMedal({ id, earned = true, size = 48, decorative, className, style }: BadgeMedalProps) {
  const text = useBadgeText()[id]
  const gid = useId().replace(/:/g, '')
  const tier = BADGE_TIER[id] ?? 'bronze'
  const label = `${text.title} (${text.tier}${earned ? '' : `, ${translate(BADGE_M, 'locked', undefined)}`})`
  const iconSize = Math.round(size * 0.4)
  return (
    <span
      className={`sq-medal sq-medal--${tier}${earned ? '' : ' is-locked'}${className ? ` ${className}` : ''}`}
      style={{ ['--sz' as string]: `${size}px`, ...style }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      title={decorative ? undefined : `${text.title}: ${text.description}`}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" className="sq-medal__rim-hi" />
            <stop offset="1" className="sq-medal__rim-lo" />
          </linearGradient>
          <linearGradient id={`${gid}-face`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="sq-medal__face-hi" />
            <stop offset="1" className="sq-medal__face-lo" />
          </linearGradient>
        </defs>
        <g fill={`url(#${gid}-rim)`}>
          <circle cx="24" cy="24" r="19.5" />
          {SCALLOPS.map((p, i) => (
            <circle key={i} cx={p.cx} cy={p.cy} r="3.7" />
          ))}
        </g>
        <circle cx="24" cy="24" r="16.2" fill={`url(#${gid}-face)`} className="sq-medal__face" />
        <circle cx="24" cy="24" r="16.2" fill="none" className="sq-medal__ring" />
        <path d="M13.5 17.5a12.5 12.5 0 0 1 9-7.4" fill="none" className="sq-medal__shine" />
      </svg>
      <span className="sq-medal__glyph" aria-hidden="true">
        <Icon name={BADGE_ICON[id]} size={iconSize} strokeWidth={2} />
      </span>
      {!earned && (
        <span className="sq-medal__lock" aria-hidden="true">
          <Icon name="lock" size={Math.max(10, Math.round(size * 0.22))} strokeWidth={2.2} />
        </span>
      )}
    </span>
  )
}
