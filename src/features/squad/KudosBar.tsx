import type { JSX } from 'react'
import { put, remove, useMe, useStore } from '../../data/store'
import type { Cheer } from '../../data/types'
import { useT } from '../../i18n'
import { uuid } from '../../lib/ids'
import { AvatarStack } from '../../ui'
import { kudosFor, reactors, toggleKudos } from './logic/kudos'
import { fmtList } from './format'
import { SQ } from './messages'
import './squad.css'

/**
 * Emoji reactions on a feed item (🔥 💪 👏 🏆). Tapping toggles your own kudos (a Cheer of kind 'kudos'
 * referencing the item). On your own items you see who reacted, but can't react yourself.
 */
export function KudosBar({ itemId, toId }: { itemId: string; toId: string }): JSX.Element {
  const t = useT(SQ)
  const me = useMe()
  const kudos = useStore((s) => {
    const out: Cheer[] = []
    for (const c of Object.values(s.cheers)) if (c.kind === 'kudos' && c.ref === itemId) out.push(c)
    return out
  })
  const members = useStore((s) => s.members)
  const entries = kudosFor(kudos, itemId, me?.id ?? null)
  const own = !me || me.id === toId
  const who = reactors(entries, kudos)
    .map((id) => members[id])
    .filter(Boolean)
  const shown = own ? entries.filter((e) => e.count > 0) : entries.filter((e, i) => i < 4 || e.count > 0)

  const onToggle = (i: number) => {
    if (!me) return
    const change = toggleKudos({ entry: entries[i], itemId, toId, viewerId: me.id, id: uuid(), now: Date.now() })
    if (!change) return
    if (change.type === 'put') put('cheers', change.row)
    else remove('cheers', change.id)
    try {
      navigator.vibrate?.(8)
    } catch {
      /* not supported */
    }
  }

  if (own && !shown.length) return <div className="sq-kudos sq-kudos--empty" />

  return (
    <div className="sq-kudos" role="group" aria-label={t('kudosLabel')}>
      <div className="sq-kudos__list">
        {shown.map((e) => {
          const i = entries.indexOf(e)
          const names = e.fromIds.map((id) => (id === me?.id ? t('you') : (members[id]?.name ?? '?')))
          const title = e.count ? t('kudosFrom', { names: fmtList(names) }) : undefined
          if (own) {
            return (
              <span key={e.emoji} className="sq-react is-static" title={title}>
                <span className="sq-react__emoji" aria-hidden="true">
                  {e.emoji}
                </span>
                <span className="sq-react__n num" aria-hidden="true">
                  {e.count}
                </span>
                <span className="visually-hidden">{title}</span>
              </span>
            )
          }
          const mine = !!e.mine
          return (
            <button
              key={e.emoji}
              type="button"
              className={`sq-react${mine ? ' is-mine' : ''}${e.count ? '' : ' is-zero'}`}
              aria-pressed={mine}
              aria-label={`${mine ? t('removeReaction', { emoji: e.emoji }) : t('reactWith', { emoji: e.emoji })}${e.count ? ` · ${e.count}` : ''}`}
              title={title}
              onClick={() => onToggle(i)}
            >
              <span className="sq-react__emoji" aria-hidden="true">
                {e.emoji}
              </span>
              {e.count > 0 && (
                <span className="sq-react__n num" aria-hidden="true">
                  {e.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {who.length > 0 && <AvatarStack className="sq-kudos__who" members={who} size={24} max={3} />}
    </div>
  )
}
