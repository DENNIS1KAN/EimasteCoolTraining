import { useMemo } from 'react'
import { Banner, Button, Card, CardHeader } from '../../../ui'
import { useT } from '../../../i18n'
import type { Member } from '../../../data/types'
import { COMMON } from '../../../i18n/common'
import { todayISO } from '../../../lib/dates'
import { programWeekOn, type SquadData } from '../../../lib/stats'
import type { InvitesState } from '../hooks/useInvites'
import { lastActiveAt } from '../lib/glance'
import { M } from '../messages'
import { MemberRow, type MemberRowInfo } from './MemberRow'

export interface MembersCardProps {
  members: Member[]
  data: SquadData
  invites: InvitesState
  meId: string | null
  onAdd: () => void
}

/** Everyone in the squad with their login status, program week and last activity. */
export function MembersCard({ members, data, invites, meId, onAdd }: MembersCardProps) {
  const t = useT(M)
  const tc = useT(COMMON)
  const today = todayISO()

  const rows: MemberRowInfo[] = useMemo(
    () =>
      members.map((m) => {
        const program = m.programId ? data.programs[m.programId] : undefined
        const week = program && m.programStart ? programWeekOn(program, m.programStart, today) : 0
        return { member: m, program: program ?? null, week, lastActiveAt: lastActiveAt(data, m.id) }
      }),
    [members, data, today],
  )
  const onlyMe = members.length <= 1

  return (
    <Card as="section" className="members-card" aria-labelledby="coach-members-title">
      <CardHeader
        title={<span id="coach-members-title">{t('membersTitle')}</span>}
        subtitle={onlyMe ? t('membersSubOne') : t('membersSub', { n: members.length })}
        action={
          <Button variant="tonal" size="sm" icon="user-plus" onClick={onAdd}>
            {t('addMember')}
          </Button>
        }
      />
      {invites.error ? (
        <Banner
          tone="warn"
          action={
            <Button variant="ghost" size="sm" onClick={invites.reload}>
              {tc('retry')}
            </Button>
          }
        >
          {t('invitesError')}
        </Banner>
      ) : null}
      <ul className="member-list">
        {rows.map((r) => (
          <MemberRow key={r.member.id} info={r} code={invites.codes?.[r.member.id]} loadingCode={invites.loading && !invites.codes} isMe={r.member.id === meId} />
        ))}
      </ul>
    </Card>
  )
}
