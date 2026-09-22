import { useParams } from 'react-router'
import { ButtonLink, EmptyState, PageHeader } from '../../ui'
import { useT } from '../../i18n'
import { useMe, useStore } from '../../data/store'
import { M } from './messages'
import { MemberEditor } from './member/MemberEditor'
import './coach.css'

/** Coach: edit one member (profile, goals, program and start, coach note, invite and login). */
export default function CoachMemberPage() {
  const t = useT(M)
  const { slug } = useParams()
  const me = useMe()
  const member = useStore((s) => Object.values(s.members).find((m) => m.slug === slug) ?? null)

  if (!member || !me) {
    return (
      <div className="coach-page">
        <PageHeader back="/coach" eyebrow={t('editEyebrow')} title={t('notFound')} />
        <EmptyState
          icon="user"
          title={t('notFound')}
          body={t('notFoundBody')}
          action={
            <ButtonLink to="/coach" variant="secondary" icon="chevron-left">
              {t('backToCoach')}
            </ButtonLink>
          }
        />
      </div>
    )
  }
  // keyed by id: switching members starts a fresh draft
  return <MemberEditor key={member.id} member={member} viewer={me} />
}
