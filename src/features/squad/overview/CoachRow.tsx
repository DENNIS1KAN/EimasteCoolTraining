import { Link } from 'react-router'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { Avatar, Icon, Tag } from '../../../ui'
import { NudgeButton } from '../NudgeButton'
import { memberHref } from '../format'
import { SQ } from '../messages'

/**
 * Someone outside the league, as a compact row under the athletes: the coach ("Coach" tag, "Coaching N athletes")
 * or an athlete who doesn't compete ("Not competing").
 */
export function CoachRow({ member, isMe, athletes }: { member: Member; isMe: boolean; athletes: number }) {
  const t = useT(SQ)
  const coach = member.role === 'coach'
  const sub = member.goal || (coach ? (athletes > 0 ? (athletes === 1 ? t('coachingOne') : t('coachingN', { n: athletes })) : '') : t('notCompetingBody'))
  return (
    <article className="ui-card sq-coach">
      <Avatar member={member} size={40} you={isMe} decorative />
      <div className="sq-coach__id">
        <p className="sq-coach__name">
          <Link to={memberHref(member)} className="sq-stretch" title={t('openProfile', { name: member.name })}>
            {member.name}
          </Link>
          {coach ? <Tag icon="whistle">{t('coachRole')}</Tag> : <Tag>{t('notCompeting')}</Tag>}
          {isMe && <Tag tone="accent">{t('youLabel')}</Tag>}
        </p>
        {sub ? <p className="sq-coach__sub">{sub}</p> : null}
      </div>
      {isMe ? <Icon name="chevron-right" size={18} className="sq-comp__chev" /> : <span className="sq-above"><NudgeButton member={member} size="sm" /></span>}
    </article>
  )
}
