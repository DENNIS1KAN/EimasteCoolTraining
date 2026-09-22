import { AvatarStack, Card, CardHeader } from '../../../ui'
import { useT } from '../../../i18n'
import type { Member, Program } from '../../../data/types'
import { fmtNum } from '../../../lib/format'
import { PatternStrip } from '../components/PatternStrip'
import { blockGroups, programSummary } from '../lib/programs'
import { M } from '../messages'

/** Description, size, weekly pattern (Mon..Sun), blocks and who is on the program. */
export function ProgramOverview({ program, members }: { program: Program; members: Member[] }) {
  const t = useT(M)
  const s = programSummary(program)
  const groups = blockGroups(program)

  return (
    <Card as="section" className="program-overview" aria-labelledby="program-overview-title">
      <div className="program-overview__col">
        <CardHeader title={<span id="program-overview-title">{t('description')}</span>} />
        {program.description ? <p className="program-overview__desc">{program.description}</p> : null}
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
      </div>

      <div className="program-overview__col">
        <div className="stack-sm">
          <div className="row-between">
            <p className="micro muted">{t('weeklyPattern')}</p>
            <p className="program-overview__hint">{t('patternHint')}</p>
          </div>
          <PatternStrip program={program} label={t('weeklyPattern')} />
        </div>

        {groups.length > 1 || groups[0]?.block ? (
          <ol className="block-bar" aria-label={t('weeksTitle')}>
            {groups.map((g) => (
              <li key={`${g.block}-${g.weeks[0]}`} className="block-bar__seg" style={{ flexGrow: g.weeks.length }}>
                <span className="block-bar__name">{g.block || '–'}</span>
                <span className="block-bar__weeks">
                  {g.weeks.length === 1 ? t('blockWeek', { n: g.weeks[0] }) : t('blockWeeks', { from: g.weeks[0], to: g.weeks[g.weeks.length - 1] })}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="program-overview__members">
          <p className="micro muted">{t('onProgram')}</p>
          {members.length ? (
            <div className="row">
              <AvatarStack members={members} size={32} max={6} />
              <p className="program-overview__names">{members.map((m) => m.name).join(', ')}</p>
            </div>
          ) : (
            <p className="program-overview__names is-empty">{t('nobodyOnIt')}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
