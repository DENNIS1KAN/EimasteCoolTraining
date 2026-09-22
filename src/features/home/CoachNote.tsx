import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import { isoFromMs } from '../../lib/dates'
import { fmtRelative } from '../../lib/format'
import { fmtTimeOfDay } from './format'
import { Avatar, Card, Tag } from '../../ui'
import { HM } from './messages'

const DAY = 86_400_000

/** The coach's note to the viewer (member.coachNote), with who wrote it and when. Null without a note. */
export function CoachNote({ me, coach, now }: { me: Member; coach: Member | null; now: number }) {
  const t = useT(HM)
  const text = me.coachNote.trim()
  if (!text) return null
  const at = me.coachNoteAt
  const when = at == null ? null : isoFromMs(at) === isoFromMs(now) ? fmtTimeOfDay(at) : fmtRelative(at, now)
  const fresh = at != null && now - at < DAY
  const name = coach?.name ?? t('theCoach')
  return (
    <Card as="section" className="home-note" aria-label={t('noteLabel', { name })}>
      {coach ? <Avatar member={coach} size={32} decorative /> : null}
      <div className="home-note__body">
        <p className="home-note__meta">
          <b>{coach ? t('fromCoach', { name: coach.name }) : name}</b>
          {when ? (
            <>
              <span aria-hidden="true"> · </span>
              <time dateTime={new Date(at!).toISOString()}>{when}</time>
            </>
          ) : null}
          {fresh ? (
            <Tag tone="accent" className="home-note__new">
              {t('new')}
            </Tag>
          ) : null}
        </p>
        <p className="home-note__text">{text}</p>
      </div>
    </Card>
  )
}
