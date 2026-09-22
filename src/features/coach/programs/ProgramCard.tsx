import { Link } from 'react-router'
import { AvatarStack, Button, ButtonLink, Card, IconButton, Tag, toast } from '../../../ui'
import { useT } from '../../../i18n'
import type { Member, Program } from '../../../data/types'
import { fmtNum } from '../../../lib/format'
import { programSummary } from '../lib/programs'
import { M } from '../messages'

export interface ProgramCardProps {
  program: Program
  /** Members assigned to it. */
  members: Member[]
  onExport: () => void
  onDelete: () => void
}

/** A program with its size, who is on it, and View / Export / Delete. */
export function ProgramCard({ program: p, members, onExport, onDelete }: ProgramCardProps) {
  const t = useT(M)
  const s = programSummary(p)
  const names = members.map((m) => m.name).join(', ')

  const tryDelete = () => {
    if (members.length) {
      toast(t('deleteBlocked', { names, verb: members.length === 1 ? t('verbOne') : t('verbMany') }), { tone: 'danger', duration: 6000 })
      return
    }
    onDelete()
  }

  return (
    <Card as="article" className="program-card" aria-labelledby={`program-${p.id}`}>
      <div className="program-card__top">
        <Tag tone={p.builtIn ? 'solid' : 'accent'} icon={p.builtIn ? 'lock' : 'upload'}>
          {p.builtIn ? t('builtIn') : t('imported')}
        </Tag>
        {!p.builtIn ? <IconButton icon="trash" label={t('deleteA11y', { name: p.name })} variant="ghost" size={36} onClick={tryDelete} /> : null}
      </div>
      <h3 className="program-card__name" id={`program-${p.id}`}>
        <Link to={`/coach/program/${encodeURIComponent(p.id)}`}>{p.name}</Link>
      </h3>
      {p.description ? <p className="program-card__desc">{p.description}</p> : null}
      <dl className="spec-strip">
        <div>
          <dt className="micro">{t('statWeeks')}</dt>
          <dd className="num">{fmtNum(s.weeks, 0)}</dd>
        </div>
        <div>
          <dt className="micro">{t('statDays')}</dt>
          <dd className="num">{fmtNum(s.daysPerWeek, 0)}</dd>
        </div>
        <div>
          <dt className="micro">{t('statExercises')}</dt>
          <dd className="num">{fmtNum(s.uniqueExercises, 0)}</dd>
        </div>
      </dl>
      <div className="program-card__members">
        {members.length ? (
          <>
            <AvatarStack members={members} size={32} max={5} />
            <p className="program-card__names">
              <span className="micro">{t('onProgram')}</span>
              <span className="truncate">{names}</span>
            </p>
          </>
        ) : (
          <p className="program-card__names is-empty">{t('nobodyOnIt')}</p>
        )}
      </div>
      <div className="program-card__actions">
        <ButtonLink to={`/coach/program/${encodeURIComponent(p.id)}`} variant="secondary" size="sm" iconRight="arrow-right">
          {t('view')}
        </ButtonLink>
        <Button variant="ghost" size="sm" icon="download" onClick={onExport}>
          {t('exportCsv')}
        </Button>
      </div>
    </Card>
  )
}
