import { Link } from 'react-router'
import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { Avatar, ButtonLink, Icon } from '../../../ui'
import { SQ } from '../messages'

/** First-run guidance: athletes get "start the first workout", the coach gets athletes still missing a start date. */
export function KickoffCard({ viewer, unstarted }: { viewer: Member; unstarted: Member[] }) {
  const t = useT(SQ)
  if (viewer.role === 'coach') {
    return (
      <section className="ui-card sq-kickoff" aria-labelledby="sq-kickoff-h">
        <span className="sq-kickoff__icon" aria-hidden="true">
          <Icon name="calendar" size={22} />
        </span>
        <h2 id="sq-kickoff-h" className="sq-kickoff__title">
          {t('coachKickoffTitle')}
        </h2>
        <p className="sq-kickoff__body">{t('coachKickoffBody')}</p>
        <ul className="sq-kickoff__list">
          {unstarted.map((m) => (
            <li key={m.id}>
              <Link to={`/coach/member/${encodeURIComponent(m.slug)}`} className="sq-kickoff__row">
                <Avatar member={m} size={32} decorative />
                <span className="sq-kickoff__name">{m.name}</span>
                <span className="sq-kickoff__cta">{t('setStart')}</span>
                <Icon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  return (
    <section className="ui-card sq-kickoff" aria-labelledby="sq-kickoff-h">
      <span className="sq-kickoff__icon" aria-hidden="true">
        <Icon name="flame" size={22} />
      </span>
      <h2 id="sq-kickoff-h" className="sq-kickoff__title">
        {t('firstWorkoutTitle')}
      </h2>
      <p className="sq-kickoff__body">{t('firstWorkoutBody')}</p>
      <ButtonLink to="/train" icon="play" block>
        {t('startWorkout')}
      </ButtonLink>
    </section>
  )
}
