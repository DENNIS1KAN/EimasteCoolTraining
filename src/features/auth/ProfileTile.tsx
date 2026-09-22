import { useT } from '../../i18n'
import { COMMON } from '../../i18n/common'
import type { LoginProfile } from '../../data/types'
import { Avatar, Icon, Spinner } from '../../ui'
import { memberColorVar } from '../../ui/member'
import { AUTH } from './messages'

interface Props {
  profile: LoginProfile
  selected: boolean
  busy: boolean
  disabled?: boolean
  onSelect: (p: LoginProfile) => void
}

/** "Who's training?" tile: avatar with the member's glow, name and role. Not-joined members are greyed out. */
export function ProfileTile({ profile: p, selected, busy, disabled, onSelect }: Props) {
  const t = useT(AUTH)
  const c = useT(COMMON)
  const pending = !p.joined
  const role = p.role === 'coach' ? c('coach') : c('athlete')
  return (
    <li className="auth-tile-wrap">
      <button
        type="button"
        className={['auth-tile', selected && 'is-selected', pending && 'is-pending'].filter(Boolean).join(' ')}
        style={{ ['--tile-color' as string]: memberColorVar(p.color) }}
        aria-pressed={selected}
        aria-busy={busy || undefined}
        aria-label={`${p.name}, ${role}${pending ? `, ${t('invitePending')}` : ''}`}
        disabled={disabled}
        onClick={() => onSelect(p)}
      >
        <span className="auth-tile__avatar">
          <Avatar member={{ name: p.name, color: p.color }} size={54} decorative />
          {busy ? (
            <span className="auth-tile__busy">
              <Spinner size={22} decorative />
            </span>
          ) : null}
          {pending ? (
            <span className="auth-tile__badge auth-tile__badge--pending" aria-hidden="true">
              <Icon name="clock" size={12} strokeWidth={2.4} />
            </span>
          ) : null}
          {selected && !busy && !pending ? (
            <span className="auth-tile__badge" aria-hidden="true">
              <Icon name="check" size={12} strokeWidth={2.6} />
            </span>
          ) : null}
        </span>
        <span className="auth-tile__name">{p.name}</span>
        {pending ? (
          <span className="auth-tile__role auth-tile__role--pending">{t('invitePending')}</span>
        ) : (
          <span className="auth-tile__role">
            {p.role === 'coach' ? <Icon name="whistle" size={12} strokeWidth={2.2} /> : null}
            {role}
          </span>
        )}
      </button>
    </li>
  )
}
