import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Member, Unit } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtDuration, fmtNum, fmtVolume, fmtWeight } from '../../../lib/format'
import { kgToUnit } from '../../../lib/units'
import type { FeedItem } from '../../../lib/stats'
import { Avatar, Delta, Icon, PRBadge } from '../../../ui'
import { BadgeMedal, useBadgeText } from '../badges'
import { KudosBar } from '../KudosBar'
import { fmtTime, memberHref, memberWorkoutHref } from '../format'
import { kudosOwner } from '../logic/feedGroups'
import { cheerLine } from '../logic/nudges'
import { weightAccess } from '../logic/visibility'
import { changeDir, weightChangeTone } from '../logic/weight'
import { SQ } from '../messages'

const FEEL_KEYS = ['feel1', 'feel2', 'feel3', 'feel4', 'feel5'] as const

export interface FeedItemViewProps {
  item: FeedItem
  members: Record<string, Member>
  me: Member | null
  unit: Unit
  /** Compact rendering for the Home pulse card (no notes, fewer details). */
  compact?: boolean
  /** Show the relative day instead of the time of day. */
  timeLabel?: string
}

export function FeedItemView({ item, members, me, unit, compact, timeLabel }: FeedItemViewProps) {
  const t = useT(SQ)
  const badgeText = useBadgeText()
  const m = members[item.memberId]
  if (!m) return null
  const name = (x: Member | undefined) => (x ? (x.id === me?.id ? t('youCap') : x.name) : '?')
  // Greek conjugates by person ("τελείωσε" / "τελείωσες"), so "you" items use their own strings.
  const isMe = m.id === me?.id
  const time = timeLabel ?? (item.kind === 'weighin' || item.kind === 'badge' ? null : fmtTime(item.at))
  const who = (
    <Link to={memberHref(m)} className="sq-feed__who">
      {m.id === me?.id ? <span className="sq-feed__you">{t('you')}</span> : m.name}
    </Link>
  )
  const stamp = time ? (
    <>
      <span className="sq-dot" aria-hidden="true">
        ·
      </span>
      <time className="sq-feed__time" dateTime={new Date(item.at).toISOString()}>
        {time}
      </time>
    </>
  ) : null

  let lead = <Avatar member={m} size={40} decorative />
  let body: ReactNode = null

  switch (item.kind) {
    case 'workout': {
      const s = item.summary
      const href = memberWorkoutHref(m, item.week, item.day)
      const meta = [
        t('weekShort', { n: item.week }),
        t('setsN', { n: s.setsDone }),
        s.volumeKg > 0 ? fmtVolume(s.volumeKg, unit) : null,
        s.durationMs ? fmtDuration(s.durationMs) : null,
      ].filter(Boolean)
      body = (
        <>
          <p className="sq-feed__line">
            {who}{' '}
            <Link to={href} className="sq-feed__what">
              {item.dayName ? (
                <>
                  {t(isMe ? 'finishedVerbYou' : 'finishedVerb')} <b>{item.dayName}</b>
                </>
              ) : (
                t(isMe ? 'finishedWorkoutYou' : 'finishedWorkout')
              )}
            </Link>
            {stamp}
          </p>
          <p className="sq-feed__meta">{meta.join(' · ')}</p>
          {item.prs.length > 0 && (
            <ul className="sq-feed__prs">
              {item.prs.slice(0, compact ? 1 : 4).map((p) => (
                <li key={p.exercise}>
                  <PRBadge />
                  <span className="sq-feed__pr-ex">{p.exercise}</span>
                  <span className="sq-feed__pr-set num">
                    {fmtNum(kgToUnit(p.kg, unit), 1)}
                    <i className="mul">×</i>
                    {p.reps}
                  </span>
                </li>
              ))}
              {compact && item.prs.length > 1 ? <li className="sq-feed__more">+{item.prs.length - 1}</li> : null}
            </ul>
          )}
          {!compact && (item.feel != null || item.note) ? (
            <div className="sq-feed__extra">
              {item.feel != null && item.feel >= 1 && item.feel <= 5 ? (
                <span className="sq-feed__feel">{t('felt', { feel: t(FEEL_KEYS[item.feel - 1]) })}</span>
              ) : null}
              {item.note ? <q className="sq-feed__note">{item.note}</q> : null}
            </div>
          ) : null}
        </>
      )
      break
    }
    case 'weighin': {
      const access = weightAccess(m, me)
      const change = item.changeKg
      body = (
        <>
          <p className="sq-feed__line">
            {who} {t(isMe ? 'weighedInYou' : 'weighedIn')}
            {stamp}
          </p>
          <p className="sq-feed__weigh">
            {access === 'exact' ? <span className="num sq-feed__kg">{fmtWeight(item.kg, unit)}</span> : null}
            {change != null ? (
              <>
                <Delta
                  text={`${fmtNum(kgToUnit(Math.abs(change), unit), 1)} ${unit}`}
                  dir={changeDir(change)}
                  tone={weightChangeTone(change, item.kg - change, m.goalWeightKg)}
                />
                <span className="sq-feed__meta">{t('vsLastWeek')}</span>
              </>
            ) : (
              <span className="sq-feed__meta">{t('firstWeighIn')}</span>
            )}
          </p>
        </>
      )
      lead = (
        <span className="sq-feed__lead">
          <Avatar member={m} size={40} decorative />
          <span className="sq-feed__glyph" aria-hidden="true">
            <Icon name="scale" size={12} strokeWidth={2.2} />
          </span>
        </span>
      )
      break
    }
    case 'badge': {
      lead = <BadgeMedal id={item.badge} size={40} decorative />
      body = (
        <>
          <p className="sq-feed__line">
            {who} {t(isMe ? 'earnedBadgeYou' : 'earnedBadge')}
            {stamp}
          </p>
          <p className="sq-feed__badge">
            <b>{badgeText[item.badge].title}</b>
            <span className="sq-feed__meta"> · {badgeText[item.badge].description}</span>
          </p>
        </>
      )
      break
    }
    case 'nudge':
    case 'message': {
      const to = members[item.toId]
      body = (
        <>
          <p className="sq-feed__line">
            {who}
            <Icon name="arrow-right" size={14} className="sq-feed__arrow" title={item.kind === 'message' ? t('messaged', { name: name(to) }) : t('nudged', { name: name(to) })} />
            {to ? (
              <Link to={memberHref(to)} className="sq-feed__who">
                {name(to)}
              </Link>
            ) : (
              '?'
            )}
            {stamp}
          </p>
          <p className={`sq-bubble${item.kind === 'message' ? ' is-message' : ''}`}>{cheerLine(item)}</p>
        </>
      )
      break
    }
    case 'plan': {
      const by = members[item.byId]
      lead = by ? <Avatar member={by} size={40} decorative /> : lead
      const mine = item.memberId === me?.id
      body = (
        <>
          <p className="sq-feed__line">
            {t('newPlanFor', { name: isMe ? t('forYou') : m.name })}
            {stamp}
          </p>
          <p className="sq-feed__plan">
            <Icon name="fuel" size={14} />
            {mine ? (
              <Link to="/fuel" className="sq-feed__what">
                <b>{item.title}</b>
              </Link>
            ) : (
              <b>{item.title}</b>
            )}
            {by ? <span className="sq-feed__meta">{t('byCoach', { name: by.name })}</span> : null}
          </p>
        </>
      )
      break
    }
  }

  return (
    <article className={`sq-feed__item sq-feed__item--${item.kind}${compact ? ' is-compact' : ''}`}>
      <div className="sq-feed__lead-col">{lead}</div>
      <div className="sq-feed__body">
        {body}
        <KudosBar itemId={item.id} toId={kudosOwner(item)} />
      </div>
    </article>
  )
}
