import { useT } from '../../../i18n'
import { Card, DateField, Switch, TextField } from '../../../ui'
import type { DraftErrors, PlanDraft } from '../lib/draft'
import { FM } from '../messages'
import { errorKey } from './errors'

export interface SectionProps {
  draft: PlanDraft
  errors: DraftErrors | null
  onChange: (patch: Partial<PlanDraft>) => void
}

export function BasicsSection({ draft, errors, onChange }: SectionProps) {
  const t = useT(FM)
  const err = (k: 'title' | 'startDate') => {
    const key = errorKey(errors?.fields[k])
    return key ? t(key) : undefined
  }
  return (
    <Card as="section" className="fu-ed__card" aria-labelledby="fu-ed-basics">
      <h2 id="fu-ed-basics" className="fu-h">
        {t('basics')}
      </h2>
      <TextField
        label={t('planTitle')}
        placeholder={t('planTitlePh')}
        value={draft.title}
        maxLength={80}
        error={err('title')}
        onChange={(e) => onChange({ title: e.target.value })}
      />
      <DateField label={t('startDate')} value={draft.startDate} error={err('startDate')} onChange={(v) => onChange({ startDate: v })} />
      <Switch checked={draft.active} onChange={(v) => onChange({ active: v })} label={t('activeLabel')} description={t('activeDesc')} />
    </Card>
  )
}
