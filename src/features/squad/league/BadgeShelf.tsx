import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { BADGES, earnedBadges, type BadgeId, type SquadData } from '../../../lib/stats'
import { Avatar, Card, SectionTitle } from '../../../ui'
import { BadgeMedal, useBadgeText } from '../badges'
import { BadgeSheet } from '../components/BadgeSheet'
import { memberHref } from '../format'
import { SQ } from '../messages'

interface Shelf {
  member: Member
  items: { id: BadgeId; at: number | null }[]
  earned: number
}

/** Each member's medals: earned ones first (newest first), then the locked ones dimmed. */
export function BadgeShelf({ data, members, meId }: { data: SquadData; members: Member[]; meId: string | null }) {
  const t = useT(SQ)
  const text = useBadgeText()
  const [open, setOpen] = useState<{ id: BadgeId; at: number | null; owner: string } | null>(null)
  const shelves = useMemo<Shelf[]>(
    () =>
      members.map((m) => {
        const earned = earnedBadges(data, m.id).sort((a, b) => b.at - a.at)
        const got = new Set(earned.map((b) => b.id))
        return {
          member: m,
          earned: earned.length,
          items: [...earned.map((b) => ({ id: b.id, at: b.at as number | null })), ...BADGES.filter((b) => !got.has(b.id)).map((b) => ({ id: b.id, at: null }))],
        }
      }),
    [data, members],
  )
  return (
    <section className="stack" aria-labelledby="sq-shelf-h">
      <SectionTitle title={<span id="sq-shelf-h">{t('badgesShelf')}</span>} />
      <Card padding="none" className="sq-shelves">
        {shelves.map((s) => (
          <div key={s.member.id} className="sq-shelf">
            <div className="sq-shelf__head">
              <Avatar member={s.member} size={32} you={s.member.id === meId} decorative />
              <Link to={memberHref(s.member)} className="sq-shelf__name">
                {s.member.name}
              </Link>
              <span className="sq-shelf__count">
                <b className="num">{s.earned}</b> / {BADGES.length}
              </span>
            </div>
            <ul className="sq-shelf__row" aria-label={`${s.member.name}: ${t('badgesCount', { n: s.earned, total: BADGES.length })}`}>
              {s.items.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    className={`sq-shelf__medal${b.at != null ? '' : ' is-locked'}`}
                    aria-label={`${text[b.id].title}${b.at != null ? '' : ` (${t('locked')})`}`}
                    onClick={() => setOpen({ ...b, owner: s.member.name })}
                  >
                    <BadgeMedal id={b.id} earned={b.at != null} size={46} decorative />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
      <BadgeSheet badge={open} ownerName={open?.owner} onClose={() => setOpen(null)} />
    </section>
  )
}
