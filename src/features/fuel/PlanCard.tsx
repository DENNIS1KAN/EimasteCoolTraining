import { useId, useState } from 'react'
import type { MealPlan, Member } from '../../data/types'
import { useT } from '../../i18n'
import { fmtRelative } from '../../lib/format'
import { Avatar, Card, Icon, Tag } from '../../ui'
import { PlanFiles } from './PlanFiles'
import { PlanNotes } from './PlanNotes'
import { FM } from './messages'

/** "From Coach Dennis" / "Your own plan" / "From Thanos". */
export function useAuthorLine() {
  const t = useT(FM)
  return (plan: MealPlan, author: Member | null, meId: string | null): string => {
    if (plan.createdBy && plan.createdBy === meId) return t('ownPlan')
    if (!author) return ''
    return author.role === 'coach' ? t('fromCoach', { name: author.name }) : t('fromName', { name: author.name })
  }
}

const isLong = (notes: string) => notes.length > 260 || notes.split('\n').filter((l) => l.trim()).length > 7

export interface PlanCardProps {
  plan: MealPlan
  author: Member | null
  meId: string | null
}

/** The plan in force: author, title, status, files and the coach's notes. */
export function PlanCard({ plan, author, meId }: PlanCardProps) {
  const t = useT(FM)
  const authorLine = useAuthorLine()
  const [open, setOpen] = useState(false)
  const notesId = useId()
  const long = isLong(plan.notes)
  const who = authorLine(plan, author, meId)
  return (
    <Card as="section" className="fu-plan" aria-labelledby={`${notesId}-t`}>
      <div className="fu-plan__head">
        {author ? <Avatar member={author} size={36} decorative /> : <span className="fu-plan__noav" aria-hidden="true"><Icon name="fuel" size={18} /></span>}
        <div className="fu-plan__titles">
          <h2 id={`${notesId}-t`} className="fu-plan__title">
            {plan.title}
          </h2>
          <p className="fu-plan__sub">
            {[who, t('updated', { when: fmtRelative(plan.updatedAt) })].filter(Boolean).join(' · ')}
          </p>
        </div>
        {plan.active && (
          <Tag tone="good" icon="check" className="fu-plan__tag">
            {t('active')}
          </Tag>
        )}
      </div>
      <PlanFiles files={plan.files} />
      {plan.notes.trim() && (
        <div className="fu-plan__notes">
          <div id={notesId} className={`fu-plan__notes-body${long && !open ? ' is-clamped' : ''}`}>
            <PlanNotes text={plan.notes} />
          </div>
          {long && (
            <button type="button" className="fu-more" aria-expanded={open} aria-controls={notesId} onClick={() => setOpen((o) => !o)}>
              <span>{open ? t('showLess') : t('showMore')}</span>
              <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
            </button>
          )}
        </div>
      )}
    </Card>
  )
}
