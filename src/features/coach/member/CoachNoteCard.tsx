import { useRef, useState } from 'react'
import { Button, Card, CardHeader, Icon, TextArea, toast } from '../../../ui'
import { useT } from '../../../i18n'
import { update } from '../../../data/store'
import type { Member } from '../../../data/types'
import { fmtRelative } from '../../../lib/format'
import { M } from '../messages'

const NOTE_MAX = 500

/**
 * The note on the member's home screen: what they see now (edit or remove it), and a box for a new one.
 * Sending stamps coachNoteAt, so the athlete sees it as fresh.
 */
export function CoachNoteCard({ member }: { member: Member }) {
  const t = useT(M)
  const [draft, setDraft] = useState('')
  const boxRef = useRef<HTMLTextAreaElement>(null)
  const clean = draft.trim()

  const send = () => {
    if (!clean) return
    update('members', member.id, { coachNote: clean, coachNoteAt: Date.now() })
    setDraft('')
    toast(t('noteSent'), { tone: 'good' })
  }
  const removeNote = () => {
    const prev = { coachNote: member.coachNote, coachNoteAt: member.coachNoteAt }
    update('members', member.id, { coachNote: '', coachNoteAt: null })
    toast(t('noteRemoved'), { action: { label: t('undo'), onClick: () => update('members', member.id, prev) } })
  }
  const editCurrent = () => {
    setDraft(member.coachNote)
    requestAnimationFrame(() => {
      const el = boxRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  return (
    <Card as="section" aria-labelledby="member-note-title" className="stack-lg note-card">
      <CardHeader title={<span id="member-note-title">{t('coachNote')}</span>} subtitle={t('coachNoteHint')} />
      {member.coachNote ? (
        <figure className="note-live">
          <figcaption className="note-live__cap">
            <Icon name="home" size={14} />
            <span>{t('currentNote')}</span>
            {member.coachNoteAt ? <span className="note-live__when">{t('sentAgo', { when: fmtRelative(member.coachNoteAt) })}</span> : null}
          </figcaption>
          <blockquote className="note-live__text">{member.coachNote}</blockquote>
          <div className="note-live__actions">
            <Button variant="ghost" size="sm" icon="edit" onClick={editCurrent}>
              {t('editNote')}
            </Button>
            <Button variant="ghost" size="sm" icon="trash" onClick={removeNote}>
              {t('removeNote')}
            </Button>
          </div>
        </figure>
      ) : null}
      <TextArea
        ref={boxRef}
        label={member.coachNote ? t('newNote') : t('writeNote')}
        placeholder={t('notePh')}
        rows={3}
        maxLength={NOTE_MAX}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        hint={draft ? `${draft.length}/${NOTE_MAX}` : undefined}
      />
      <Button variant="primary" icon="message" onClick={send} disabled={!clean || clean === member.coachNote.trim()} block>
        {t('sendNote')}
      </Button>
    </Card>
  )
}
