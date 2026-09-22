import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { Avatar, Card, Icon, memberColorVar } from '../../../ui'
import { WinStrip } from '../components/WinStrip'
import type { H2H } from '../components/score'
import { useLeadText, useScoreLine } from '../components/score'
import { compareHref } from '../format'
import { SQ } from '../messages'

/** "Head-to-head" call to action: you vs your rival (or the top two for the coach) with the current score. */
export function H2HCard({ a, b, h2h, viewerId }: { a: Member; b: Member; h2h: H2H; viewerId: string | null }) {
  const t = useT(SQ)
  const scoreLine = useScoreLine()
  const leadText = useLeadText()
  const involved = viewerId === a.id || viewerId === b.id
  const title = involved ? t('h2hYouVs', { name: (viewerId === a.id ? b : a).name }) : t('h2hVs', { a: a.name, b: b.name })
  const line = scoreLine(h2h, a, b, viewerId)
  return (
    <Card
      to={compareHref(a, b)}
      className="sq-vs sq-h2h"
      style={{ ['--ca' as string]: memberColorVar(a.color), ['--cb' as string]: memberColorVar(b.color) }}
      aria-label={`${title}. ${line}. ${t('h2hCta')}`}
    >
      <p className="eyebrow sq-h2h__eyebrow">
        <Icon name="swap" size={14} /> {t('h2hEyebrow')}
      </p>
      <div className="sq-h2h__row" aria-hidden="true">
        <span className="sq-h2h__who">
          <Avatar member={a} size={40} decorative />
          <b>{viewerId === a.id ? t('youCap') : a.name}</b>
        </span>
        <span className="sq-h2h__score num">
          {h2h.a}
          <em>–</em>
          {h2h.b}
        </span>
        <span className="sq-h2h__who sq-h2h__who--b">
          <b>{viewerId === b.id ? t('youCap') : b.name}</b>
          <Avatar member={b} size={40} decorative />
        </span>
      </div>
      <WinStrip rows={h2h.rows} a={a} b={b} />
      <p className="sq-h2h__line" aria-hidden="true">
        <span>{leadText(h2h, a, b, viewerId)}</span>
        <span className="sq-h2h__cta">
          {t('h2hCta')}
          <Icon name="chevron-right" size={14} strokeWidth={2} />
        </span>
      </p>
    </Card>
  )
}
