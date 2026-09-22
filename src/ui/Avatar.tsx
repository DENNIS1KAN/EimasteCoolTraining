import type { CSSProperties } from 'react'
import type { MemberColor } from '../data/types'
import { useT } from '../i18n'
import { cx } from './cx'
import { initials, memberColorVar } from './member'
import { UIM } from './messages'

export interface AvatarMember {
  name: string
  color?: MemberColor | string
}

export interface AvatarProps {
  member: AvatarMember
  /** Diameter: 24 | 32 | 40 (default) | 54 | 80. */
  size?: 24 | 32 | 36 | 40 | 48 | 54 | 64 | 80
  /** Outer ring in the member's color (e.g. selected in a picker). */
  ring?: boolean
  /** Marks the viewer: an accent ring and "(you)" in the accessible name. */
  you?: boolean
  /** Hide from assistive tech when the name is printed next to it. */
  decorative?: boolean
  className?: string
  style?: CSSProperties
}

/** Initials on a member-color gradient, with a surface ring and (dark only) a soft member glow. */
export function Avatar({ member, size = 40, ring, you, decorative, className, style }: AvatarProps) {
  const t = useT(UIM)
  const label = you ? `${member.name} (${t('you')})` : member.name
  return (
    <span
      className={cx('ui-avatar', ring && 'ui-avatar--ring', you && 'ui-avatar--you', className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      style={{ ['--c' as string]: memberColorVar(member.color), ['--av' as string]: `${size}px`, ...style }}
    >
      <span className="ui-avatar__i" aria-hidden="true">
        {initials(member.name)}
      </span>
    </span>
  )
}

export interface AvatarStackProps {
  members: AvatarMember[]
  size?: AvatarProps['size']
  /** Max avatars shown; the rest collapse into "+N". */
  max?: number
  className?: string
}

export function AvatarStack({ members, size = 32, max = 4, className }: AvatarStackProps) {
  const t = useT(UIM)
  const shown = members.length > max ? members.slice(0, Math.max(1, max - 1)) : members
  const rest = members.length - shown.length
  const label = members.map((m) => m.name).join(', ')
  return (
    <span className={cx('ui-avatar-stack', className)} role="img" aria-label={label} style={{ ['--av' as string]: `${size}px` }}>
      {shown.map((m, i) => (
        <Avatar key={`${m.name}-${i}`} member={m} size={size} decorative />
      ))}
      {rest > 0 ? (
        <span className="ui-avatar ui-avatar--more" aria-hidden="true" title={t('moreN', { n: rest })}>
          <span className="ui-avatar__i">+{rest}</span>
        </span>
      ) : null}
    </span>
  )
}

export interface MemberNameProps {
  member: AvatarMember
  you?: boolean
  className?: string
}

/** The member's name followed by a small identity dot. The text stays ink (text never wears a member color). */
export function MemberName({ member, you, className }: MemberNameProps) {
  const t = useT(UIM)
  return (
    <span className={cx('ui-member-name', className)}>
      <span className="ui-member-name__text">{member.name}</span>
      {you ? <span className="ui-member-name__you">({t('you')})</span> : null}
      <i className="ui-member-name__dot" style={{ background: memberColorVar(member.color) }} aria-hidden="true" />
    </span>
  )
}
