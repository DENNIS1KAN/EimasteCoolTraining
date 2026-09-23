import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtDate } from '../../../lib/format'
import type { MemberStats } from '../../../lib/stats'
import { Avatar, ButtonLink, Icon, Tag, memberColorVar } from '../../../ui'
import { splitProgramName, useProgramName } from '../../train/programText'
import { NudgeButton } from '../NudgeButton'
import { compareHref } from '../format'
import { SQ } from '../messages'

export interface ProfileHeaderProps {
  member: Member
  stats: MemberStats
  isMe: boolean
  /** Who to compare with from this profile (null hides the button). */
  compareWith: Member | null
  /** Put the viewer in the left corner when comparing. */
  viewerFirst: boolean
}

/** Big avatar with the member glow, goal, program week and the profile's actions. */
export function ProfileHeader({ member, stats, isMe, compareWith, viewerFirst }: ProfileHeaderProps) {
  const t = useT(SQ)
  const program = stats.program
  const programName = useProgramName(program ?? { name: '' })
  const programLine = program
    ? stats.programWeek > 0
      ? // "BTS · week 3 of 12": the week count is already in "of 12", so drop "12 weeks" from the name
        t('programWeekOf', { program: splitProgramName(program.name)?.base ?? programName, n: stats.programWeek, total: program.weeks.length })
      : member.programStart
        ? `${programName} · ${t('startsOn', { date: fmtDate(member.programStart) })}`
        : `${programName} · ${t('notStarted')}`
    : null
  return (
    <section className="ui-card sq-profile" style={{ ['--c' as string]: memberColorVar(member.color) }} aria-label={member.name}>
      <div className="sq-profile__top">
        <Avatar member={member} size={80} you={isMe} />
        <div className="sq-profile__id">
          {!member.joined ? (
            <p className="sq-profile__tags">
              <Tag tone="warn">{t('notJoined')}</Tag>
            </p>
          ) : null}
          {member.goal ? (
            <p className="sq-profile__goal">
              <Icon name="target" size={16} />
              <span>{member.goal}</span>
            </p>
          ) : null}
          {programLine ? <p className="sq-profile__meta">{programLine}</p> : null}
          {member.programStart && stats.programWeek > 0 ? <p className="sq-profile__meta">{t('startedOn', { date: fmtDate(member.programStart, 'medium') })}</p> : null}
        </div>
      </div>
      <div className="sq-profile__actions">
        {isMe ? (
          <ButtonLink to="/settings" variant="secondary" icon="settings" block>
            {t('editProfile')}
          </ButtonLink>
        ) : (
          <NudgeButton member={member} />
        )}
        {compareWith ? (
          <ButtonLink
            to={viewerFirst ? compareHref(compareWith, member) : compareHref(member, compareWith)}
            variant={isMe ? 'secondary' : 'primary'}
            icon="swap"
            block
          >
            {t('compare')}
          </ButtonLink>
        ) : null}
      </div>
    </section>
  )
}
