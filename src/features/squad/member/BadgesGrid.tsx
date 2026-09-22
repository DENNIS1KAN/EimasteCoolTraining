import { useState } from 'react'
import { useT } from '../../../i18n'
import { fmtDate } from '../../../lib/format'
import { isoFromMs } from '../../../lib/dates'
import { BADGES, type BadgeId, type EarnedBadge } from '../../../lib/stats'
import { Card, CardHeader } from '../../../ui'
import { BadgeMedal, useBadgeText } from '../badges'
import { BadgeSheet } from '../components/BadgeSheet'
import { SQ } from '../messages'

/** Every badge: earned ones bright with the date, locked ones dimmed with what it takes. */
export function BadgesGrid({ earned, ownerName }: { earned: EarnedBadge[]; ownerName: string }) {
  const t = useT(SQ)
  const text = useBadgeText()
  const [open, setOpen] = useState<{ id: BadgeId; at: number | null } | null>(null)
  const at = new Map(earned.map((b) => [b.id, b.at]))
  const items = [...BADGES].sort((x, y) => Number(at.has(y.id)) - Number(at.has(x.id)))
  return (
    <Card as="section" className="sq-badges" aria-labelledby="sq-badges-h">
      <CardHeader
        title={<span id="sq-badges-h">{t('badges')}</span>}
        action={
          <span className="sq-shelf__count">
            <b className="num">{earned.length}</b> / {BADGES.length}
          </span>
        }
      />
      <ul className="sq-badges__grid">
        {items.map((b) => {
          const when = at.get(b.id) ?? null
          return (
            <li key={b.id}>
              <button type="button" className={`sq-badge${when != null ? '' : ' is-locked'}`} onClick={() => setOpen({ id: b.id, at: when })}>
                <BadgeMedal id={b.id} earned={when != null} size={52} decorative />
                <span className="sq-badge__title">{text[b.id].title}</span>
                <span className="sq-badge__sub">{when != null ? fmtDate(isoFromMs(when)) : text[b.id].description}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <BadgeSheet badge={open} ownerName={ownerName} onClose={() => setOpen(null)} />
    </Card>
  )
}
