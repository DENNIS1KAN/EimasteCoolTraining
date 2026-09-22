import { useState, type JSX } from 'react'
import { put, useMe, useStore } from '../../data/store'
import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import { fmtRelative } from '../../lib/format'
import { uuid } from '../../lib/ids'
import { Avatar, Button, Sheet, TextArea, toast } from '../../ui'
import { useNow } from './hooks'
import { NUDGE_MAX, charCount, cleanNudgeText, cooldown, lastNudgeAt, makeNudge } from './logic/nudges'
import { SQ } from './messages'
import './squad.css'

const PRESETS = [
  { key: 'preset1', emoji: '💪' },
  { key: 'preset2', emoji: '😄' },
  { key: 'preset3', emoji: '🔥' },
  { key: 'preset4', emoji: '⚖️' },
] as const
const CUSTOM_EMOJI = ['👊', '💪', '🔥', '😄', '⏰', '🚀']

/**
 * "Nudge" a squad mate: a sheet with preset one-tap nudges or a short custom message (140 chars).
 * One nudge per recipient every 6 hours; while cooling down the button reads "Nudged 2 h ago".
 */
export function NudgeButton({ member, size = 'md' }: { member: Member; size?: 'sm' | 'md' }): JSX.Element {
  const t = useT(SQ)
  const me = useMe()
  const meId = me?.id ?? ''
  const lastAt = useStore((s) => (meId ? lastNudgeAt(s.cheers, meId, member.id) : null))
  const now = useNow()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [emoji, setEmoji] = useState(CUSTOM_EMOJI[0])

  if (!me || me.id === member.id) return <></>
  const state = cooldown(lastAt, now)
  const cooling = !state.canNudge

  const send = (body: string, em: string) => {
    const clean = cleanNudgeText(body)
    if (!clean && !em) return
    put('cheers', makeNudge({ id: uuid(), fromId: me.id, toId: member.id, text: clean, emoji: em, now: Date.now() }))
    setOpen(false)
    setText('')
    toast(t('nudgeSent', { name: member.name }), { tone: 'good' })
  }

  const label = cooling ? t('nudgedAgo', { time: fmtRelative(state.lastAt!, now) }) : t('nudge')
  const count = charCount(text)

  return (
    <>
      <Button
        variant="secondary"
        size={size === 'sm' ? 'sm' : 'md'}
        icon={cooling ? 'check' : 'bell'}
        className={`sq-nudge-btn sq-nudge-btn--${size}`}
        disabled={cooling}
        aria-label={cooling ? `${label}. ${t('nudgeAgainAt', { time: fmtRelative(state.readyAt!, now) })}` : t('nudgeName', { name: member.name })}
        title={cooling ? t('nudgeAgainAt', { time: fmtRelative(state.readyAt!, now) }) : undefined}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {label}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('nudgeTitle', { name: member.name })}
        subtitle={t('nudgeSub')}
        footer={
          <Button block size="lg" icon="bell" disabled={!cleanNudgeText(text)} onClick={() => send(text, emoji)}>
            {t('sendNudge')}
          </Button>
        }
      >
        <div className="sq-nudge">
          <div className="sq-nudge__to" aria-hidden="true">
            <Avatar member={member} size={40} decorative />
          </div>
          <ul className="sq-nudge__presets">
            {PRESETS.map((p, i) => (
              <li key={p.key}>
                <button type="button" className="sq-nudge__preset" data-autofocus={i === 0 ? true : undefined} onClick={() => send(t(p.key), p.emoji)}>
                  <span className="sq-nudge__preset-emoji" aria-hidden="true">
                    {p.emoji}
                  </span>
                  <span className="sq-nudge__preset-text">{t(p.key)}</span>
                  <span className="sq-nudge__preset-send" aria-hidden="true">
                    {t('send')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="eyebrow sq-nudge__or">{t('customTitle')}</p>
          <div className="sq-nudge__emoji" role="radiogroup" aria-label={t('emojiLabel')}>
            {CUSTOM_EMOJI.map((em) => (
              <button
                key={em}
                type="button"
                role="radio"
                aria-checked={emoji === em}
                className={`sq-nudge__em${emoji === em ? ' is-on' : ''}`}
                onClick={() => setEmoji(em)}
              >
                <span aria-hidden="true">{em}</span>
                <span className="visually-hidden">{em}</span>
              </button>
            ))}
          </div>
          <TextArea
            label={t('customLabel')}
            rows={2}
            value={text}
            placeholder={t('customPlaceholder')}
            onChange={(e) => setText(Array.from(e.target.value).slice(0, NUDGE_MAX).join(''))}
            hint={t('chars', { n: count, max: NUDGE_MAX })}
          />
        </div>
      </Sheet>
    </>
  )
}
