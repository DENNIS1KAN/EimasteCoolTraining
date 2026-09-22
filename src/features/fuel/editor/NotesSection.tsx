import { useState } from 'react'
import { useT } from '../../../i18n'
import { Card, Chip, TextArea } from '../../../ui'
import { PlanNotes } from '../PlanNotes'
import { FM } from '../messages'

export function NotesSection({ notes, onChange }: { notes: string; onChange: (notes: string) => void }) {
  const t = useT(FM)
  const [preview, setPreview] = useState(false)
  const showPreview = preview && notes.trim().length > 0
  return (
    <Card as="section" className="fu-ed__card" aria-labelledby="fu-ed-notes">
      <div className="row-between">
        <h2 id="fu-ed-notes" className="fu-h">
          {t('notes')}
        </h2>
        <Chip icon="eye" size="sm" selected={showPreview} disabled={!notes.trim()} onClick={() => setPreview((p) => !p)}>
          {t('preview')}
        </Chip>
      </div>
      {showPreview ? (
        <div className="fu-ed__preview">
          <PlanNotes text={notes} />
        </div>
      ) : (
        <TextArea
          label={<span className="visually-hidden">{t('notes')}</span>}
          fieldClassName="fu-ed__notes"
          hint={t('notesHint')}
          placeholder={t('notesPh')}
          rows={8}
          value={notes}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Card>
  )
}
