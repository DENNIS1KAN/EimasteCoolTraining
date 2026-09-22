import { useMemo, useState } from 'react'
import { useMe } from '../../../data/store'
import { todayISO } from '../../../lib/dates'
import { sortedMembers } from '../../../lib/stats'
import { useSquadData } from '../hooks/useSquadData'
import { useInvites } from '../hooks/useInvites'
import { squadGlance } from '../lib/glance'
import { GlanceCard } from './GlanceCard'
import { MembersCard } from './MembersCard'
import { AddMemberSheet } from './AddMemberSheet'
import './squad.css'

/** Squad tab: who needs a push this week, and everyone's membership / invite status. */
export function SquadTab() {
  const me = useMe()
  const data = useSquadData()
  const today = todayISO()
  const invites = useInvites()
  const [adding, setAdding] = useState(false)

  const glance = useMemo(() => squadGlance(data, today), [data, today])
  const members = useMemo(() => sortedMembers(data), [data])

  return (
    <div className="coach-squad">
      <GlanceCard rows={glance} today={today} meId={me?.id ?? null} onAdd={() => setAdding(true)} />
      <MembersCard members={members} data={data} invites={invites} meId={me?.id ?? null} onAdd={() => setAdding(true)} />
      <AddMemberSheet open={adding} onClose={() => setAdding(false)} members={members} onCode={invites.setCode} />
    </div>
  )
}
