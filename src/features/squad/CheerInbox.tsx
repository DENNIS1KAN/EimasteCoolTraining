import type { JSX } from 'react'
import { Link } from 'react-router'
import { put, update, useMe, useStore } from '../../data/store'
import type { Cheer } from '../../data/types'
import { useT } from '../../i18n'
import { fmtRelative } from '../../lib/format'
import { uuid } from '../../lib/ids'
import { Avatar, Button, Card, CardHeader, CardLink, IconButton, toast } from '../../ui'
import { useNow } from './hooks'
import { cheerLine, isReply, makeCheerBack } from './logic/nudges'
import { memberHref } from './format'
import { SQ } from './messages'
import './squad.css'

const MAX_SHOWN = 3

/** Unseen nudges and messages for the viewer (newest first), with "Cheer back" and dismiss. Null when empty. */
export function CheerInbox(): JSX.Element | null {
  const t = useT(SQ)
  const me = useMe()
  const meId = me?.id ?? null
  const unseen = useStore((s) => {
    if (!meId) return [] as Cheer[]
    const out: Cheer[] = []
    for (const c of Object.values(s.cheers)) if (c.toId === meId && !c.seenAt && c.kind !== 'kudos') out.push(c)
    return out.sort((a, b) => b.createdAt - a.createdAt)
  })
  const members = useStore((s) => s.members)
  const now = useNow()
  if (!me || !unseen.length) return null

  const dismiss = (c: Cheer) => update('cheers', c.id, { seenAt: Date.now() })
  const dismissAll = () => unseen.forEach(dismiss)
  const cheerBack = (c: Cheer) => {
    const nowMs = Date.now()
    put('cheers', makeCheerBack({ id: uuid(), original: c, text: t('cheerBackText'), now: nowMs }))
    update('cheers', c.id, { seenAt: nowMs })
    const from = members[c.fromId]
    toast(t('cheeredBack', { name: from?.name ?? '' }), { tone: 'good' })
  }
  const shown = unseen.slice(0, MAX_SHOWN)
  const more = unseen.length - shown.length

  return (
    <Card as="section" className="sq-inbox" aria-label={t('inboxTitle')}>
      <CardHeader
        title={
          <span className="row">
            {t('inboxTitle')}
            <span className="sq-count num" aria-hidden="true">
              {unseen.length}
            </span>
          </span>
        }
        action={
          unseen.length > 1 ? (
            <button type="button" className="sq-textbtn" onClick={dismissAll}>
              {t('dismissAll')}
            </button>
          ) : undefined
        }
      />
      <ul className="sq-inbox__list">
        {shown.map((c) => {
          const from = members[c.fromId]
          if (!from) return null
          const reply = isReply(c)
          return (
            <li key={c.id} className="sq-inbox__item">
              <Link to={memberHref(from)} className="sq-inbox__av" aria-label={from.name}>
                <Avatar member={from} size={40} decorative />
              </Link>
              <div className="sq-inbox__body">
                <p className="sq-inbox__meta">
                  <b>{from.name}</b> {c.kind === 'message' ? t('wroteYou') : t('nudgedYou')}
                  <span className="sq-dot" aria-hidden="true">
                    ·
                  </span>
                  <time dateTime={new Date(c.createdAt).toISOString()}>{fmtRelative(c.createdAt, now)}</time>
                </p>
                <p className={`sq-inbox__text${c.kind === 'message' ? ' is-message' : ''}`}>{cheerLine(c)}</p>
                <div className="sq-inbox__actions">
                  {!reply && (
                    <Button variant="tonal" size="sm" icon="fist" onClick={() => cheerBack(c)}>
                      {t('cheerBack')}
                    </Button>
                  )}
                  <IconButton icon="x" label={t('dismiss')} variant="ghost" size={36} onClick={() => dismiss(c)} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {more > 0 && (
        <div className="sq-inbox__more">
          <CardLink to="/squad?tab=feed">+{more}</CardLink>
        </div>
      )}
    </Card>
  )
}
