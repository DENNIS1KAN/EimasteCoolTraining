import { Link } from 'react-router'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { Avatar, Icon, Tag } from '../../../ui'
import { NudgeButton } from '../NudgeButton'
import { memberHref } from '../format'
import { SQ } from '../messages'

/** The coach, as a compact row under the athletes. */
export function CoachRow({ member, isMe, athletes }: { member: Member; isMe: boolean; athletes: number }) {
  const t = useT(SQ)
  return (
    <article className="ui-card sq-coach">
      <Avatar member={member} size={40} you={isMe} decorative />
      <div className="sq-coach__id">
        <p className="sq-coach__name">
          <Link to={memberHref(member)} className="sq-stretch" title={t('openProfile', { name: member.name })}>
            {member.name}
          </Link>
          <Tag icon="whistle">{t('coachRole')}</Tag>
          {isMe && <Tag tone="accent">{t('youLabel')}</Tag>}
        </p>
        <p className="sq-coach__sub">{member.goal || t('coachingN', { n: athletes })}</p>
      </div>
      {isMe ? <Icon name="chevron-right" size={18} className="sq-comp__chev" /> : <span className="sq-above"><NudgeButton member={member} size="sm" /></span>}
    </article>
  )
}
