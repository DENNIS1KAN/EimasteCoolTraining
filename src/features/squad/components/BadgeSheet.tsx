import { useState } from 'react'
import type { BadgeId } from '../../../lib/stats'
import { useT } from '../../../i18n'
import { fmtDate } from '../../../lib/format'
import { isoFromMs } from '../../../lib/dates'
import { Sheet } from '../../../ui'
import { BadgeMedal, useBadgeText } from '../badges'
import { SQ } from '../messages'

/** Details of one badge: the medal, its criterion and when it was earned (or that it's still locked). */
export function BadgeSheet({ badge, onClose, ownerName }: { badge: { id: BadgeId; at: number | null } | null; onClose: () => void; ownerName?: string }) {
  const t = useT(SQ)
  const text = useBadgeText()
  // keep the last badge while the sheet animates out
  const [last, setLast] = useState(badge)
  if (badge && badge !== last) setLast(badge)
  const b = badge ?? last
  return (
    <Sheet open={!!badge} onClose={onClose} ariaLabel={b ? text[b.id].title : undefined}>
      {b ? (
        <div className="sq-badge-sheet">
          <BadgeMedal id={b.id} earned={b.at != null} size={112} decorative />
          <p className="eyebrow">{ownerName ? `${ownerName} · ${text[b.id].tier}` : text[b.id].tier}</p>
          <h2 className="sq-badge-sheet__title">{text[b.id].title}</h2>
          <p className="sq-badge-sheet__desc">{text[b.id].description}</p>
          <p className="sq-badge-sheet__when">{b.at != null ? t('earnedOn', { date: fmtDate(isoFromMs(b.at), 'medium') }) : t('locked')}</p>
        </div>
      ) : null}
    </Sheet>
  )
}
