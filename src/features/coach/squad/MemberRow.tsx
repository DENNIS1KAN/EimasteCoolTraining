import { Link } from 'react-router'
import { Avatar, Button, Icon, IconButton, Tag } from '../../../ui'
import { useT } from '../../../i18n'
import { COMMON } from '../../../i18n/common'
import type { Member, Program } from '../../../data/types'
import { fmtRelative } from '../../../lib/format'
import { useInviteActions } from '../hooks/useInviteActions'
import { appLocation, inviteLink } from '../lib/invite'
import { M } from '../messages'

export interface MemberRowInfo {
  member: Member
  program: Program | null
  /** Program week today (0 = not started). */
  week: number
  lastActiveAt: number | null
}

export interface MemberRowProps {
  info: MemberRowInfo
  code: string | undefined
  loadingCode: boolean
  isMe: boolean
}

/** A squad member: avatar, name, role, login status, program + week, last active; invite actions until they join. */
export function MemberRow({ info, code, loadingCode, isMe }: MemberRowProps) {
  const t = useT(M)
  const tc = useT(COMMON)
  const { copyLink, share } = useInviteActions()
  const { member: m, program, week } = info
  const link = code ? inviteLink(appLocation(), m.slug, code) : null

  const programLine = !program
    ? t('noProgram')
    : !m.programStart || week === 0
      ? t('programNotStarted', { program: program.name })
      : t('programWeek', { program: program.name, week })

  return (
    <li className="member-row">
      <Link to={`/coach/member/${m.slug}`} className="member-row__main" aria-label={t('editA11y', { name: m.name })}>
        <Avatar member={m} size={40} decorative you={isMe} />
        <div className="member-row__text">
          <p className="member-row__name">
            <span className="truncate">{m.name}</span>
            {isMe ? <Tag tone="accent">{t('youTag')}</Tag> : null}
          </p>
          <p className="member-row__meta truncate">
            {m.role === 'coach' ? tc('coach') : tc('athlete')} · {programLine}
          </p>
          <p className="member-row__sub">
            {m.joined ? (
              <Tag tone="good" icon="check">
                {t('joined')}
              </Tag>
            ) : (
              <Tag tone="warn" icon="clock">
                {t('invitePending')}
              </Tag>
            )}
            <span className="member-row__active">{info.lastActiveAt ? t('activeAgo', { when: fmtRelative(info.lastActiveAt) }) : t('noActivity')}</span>
          </p>
        </div>
        <span className="member-row__chev" aria-hidden="true">
          <Icon name="edit" size={18} />
        </span>
      </Link>
      {!m.joined ? (
        <div className="member-row__actions">
          <IconButton
            icon="copy"
            label={t('copyA11y', { name: m.name })}
            variant="outline"
            size={40}
            disabled={!link}
            onClick={() => link && void copyLink(link)}
          />
          <Button variant="secondary" size="sm" icon="share" disabled={!link} loading={!link && loadingCode} onClick={() => link && void share(m, link)}>
            {t('shareInvite')}
          </Button>
        </div>
      ) : null}
    </li>
  )
}
