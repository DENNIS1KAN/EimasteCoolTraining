import { useState } from 'react'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { Avatar, Icon, IconButton, Sheet } from '../../../ui'
import { SQ } from '../messages'

/** Two corner pickers (competitors only) with a swap button between them. */
export function PairPicker({
  a,
  b,
  options,
  viewerId,
  onChange,
}: {
  a: Member
  b: Member
  options: Member[]
  viewerId: string | null
  onChange: (a: Member, b: Member) => void
}) {
  const t = useT(SQ)
  const [side, setSide] = useState<'a' | 'b' | null>(null)
  const [lastSide, setLastSide] = useState<'a' | 'b'>('a')
  if (side && side !== lastSide) setLastSide(side)
  const shownSide = side ?? lastSide
  const current = shownSide === 'a' ? a : b
  const other = shownSide === 'a' ? b : a

  const pick = (m: Member) => {
    if (shownSide === 'a') onChange(m, m.id === b.id ? a : b)
    else onChange(m.id === a.id ? b : a, m)
    setSide(null)
  }

  const corner = (which: 'a' | 'b', m: Member) => (
    <button
      type="button"
      className="sq-picker__btn"
      aria-haspopup="dialog"
      aria-label={`${t(which === 'a' ? 'pickA' : 'pickB')}: ${m.name}`}
      onClick={() => setSide(which)}
    >
      <Avatar member={m} size={24} decorative />
      <span className="truncate">{m.id === viewerId ? t('youCap') : m.name}</span>
      <Icon name="chevron-down" size={16} />
    </button>
  )

  return (
    <div className="sq-picker">
      {corner('a', a)}
      <IconButton icon="swap" label={t('swap')} variant="ghost" size={44} onClick={() => onChange(b, a)} />
      {corner('b', b)}
      <Sheet open={side != null} onClose={() => setSide(null)} title={t(shownSide === 'a' ? 'pickA' : 'pickB')}>
        <ul className="sq-picker__list" role="radiogroup" aria-label={t(shownSide === 'a' ? 'pickA' : 'pickB')}>
          {options.map((m) => {
            const on = m.id === current.id
            return (
              <li key={m.id}>
                <button type="button" role="radio" aria-checked={on} className={`sq-picker__opt${on ? ' is-on' : ''}`} onClick={() => pick(m)} data-autofocus={on || undefined}>
                  <Avatar member={m} size={40} decorative />
                  <span className="sq-picker__opt-name">
                    {m.name}
                    {m.id === viewerId ? <small> · {t('youLabel')}</small> : null}
                    {m.id === other.id ? <small> · {t(shownSide === 'a' ? 'pickB' : 'pickA')}</small> : null}
                  </span>
                  {on ? <Icon name="check" size={20} /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>
    </div>
  )
}
