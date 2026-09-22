import { useT } from '../../i18n'
import { COMMON } from '../../i18n/common'
import { update, useStore } from '../../data/store'
import type { Member } from '../../data/types'
import { fmtDate } from '../../lib/format'
import { parseNum } from '../../lib/units'
import { Avatar, NumberField, TextArea, TextField } from '../../ui'
import { memberColorVar } from '../../ui/member'
import { SETTINGS } from './messages'
import { Section } from './Section'
import { useDraft } from './useDraft'

const DEBOUNCE = { debounceMs: 600 }

/** Name, goal and height (editable), plus the identity the coach controls (avatar color, program). */
export function ProfileSection({ me }: { me: Member }) {
  const t = useT(SETTINGS)
  const c = useT(COMMON)
  const program = useStore((s) => (me.programId ? (s.programs[me.programId] ?? null) : null))
  const name = useDraft(me.name, { required: true })
  const goal = useDraft(me.goal)
  const height = useDraft(me.heightCm == null ? '' : String(me.heightCm))
  const nameEmpty = name.draft.trim() === ''

  const setName = (v: string) => {
    name.setDraft(v)
    const clean = v.trim().replace(/\s+/g, ' ')
    if (clean && clean !== me.name) update('members', me.id, { name: clean.slice(0, 40) }, DEBOUNCE)
  }
  const setGoal = (v: string) => {
    goal.setDraft(v)
    update('members', me.id, { goal: v.slice(0, 160) }, DEBOUNCE)
  }
  const setHeight = (v: string) => {
    height.setDraft(v)
    const n = parseNum(v)
    if (v === '') update('members', me.id, { heightCm: null }, DEBOUNCE)
    else if (n != null && n >= 100 && n <= 250) update('members', me.id, { heightCm: Math.round(n) }, DEBOUNCE)
  }

  return (
    <Section id="profile" icon="user" title={t('profile')} sub={t('profileSub')}>
      <div className="set-profile" style={{ ['--me' as string]: memberColorVar(me.color) }}>
        <Avatar member={{ name: name.draft.trim() || me.name, color: me.color }} size={64} decorative />
        <div className="set-profile__who">
          <p className="set-profile__name">{name.draft.trim() || me.name}</p>
          <p className="set-profile__meta">
            <span className="set-profile__role">{me.role === 'coach' ? c('coach') : c('athlete')}</span>
            <span aria-hidden="true">·</span>
            <span>@{me.slug}</span>
          </p>
          {program ? (
            <p className="set-profile__program">
              {me.programStart
                ? t('programLine', { program: program.name, date: fmtDate(me.programStart, 'medium') })
                : t('programNotStarted', { program: program.name })}
            </p>
          ) : null}
        </div>
      </div>
      <p className="set-note set-note--swatch">
        <span className="set-swatch" style={{ background: memberColorVar(me.color) }} aria-hidden="true" />
        {me.role === 'coach' ? t('colorNoteCoach') : t('colorNote')}
      </p>
      <TextField
        label={t('name')}
        value={name.draft}
        onChange={(e) => setName(e.target.value)}
        {...name.bind}
        autoComplete="nickname"
        maxLength={40}
        enterKeyHint="done"
        error={nameEmpty ? t('nameRequired') : undefined}
      />
      <TextArea
        label={t('goal')}
        hint={t('goalHint')}
        placeholder={t('goalPlaceholder')}
        value={goal.draft}
        onChange={(e) => setGoal(e.target.value)}
        {...goal.bind}
        rows={2}
        maxLength={160}
      />
      <NumberField
        label={t('height')}
        hint={t('heightHint')}
        value={height.draft}
        onChange={setHeight}
        onFocus={height.bind.onFocus}
        onBlur={height.bind.onBlur}
        decimals={0}
        min={100}
        max={250}
        suffix="cm"
        placeholder="180"
      />
    </Section>
  )
}
