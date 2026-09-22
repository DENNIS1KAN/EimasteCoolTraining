import type { Member, Unit } from '../../../data/types'
import { useT } from '../../../i18n'
import { fmtSigned } from '../../../lib/format'
import { kgToUnit } from '../../../lib/units'
import type { MemberStats, MetricKey } from '../../../lib/stats'
import { Avatar, memberColorVar } from '../../../ui'
import { WinStrip } from '../components/WinStrip'
import { weightText } from '../components/WeightSummary'
import { useLeadText, type H2H } from '../components/score'
import { fmtMetric } from '../logic/metrics'
import type { WeightAccess } from '../logic/visibility'
import { SQ } from '../messages'
import { TapeRow } from './TapeRow'

type K = keyof typeof SQ.en
export const METRIC_LABEL: Record<MetricKey, K> = {
  points: 'mPoints',
  workouts: 'mWorkouts',
  consistency: 'mConsistency',
  streak: 'mStreak',
  volumeWeek: 'mVolumeWeek',
  prs: 'mPrs',
  strength: 'mStrength',
  goal: 'mGoal',
  nutrition: 'mNutrition',
}

export interface VsSide {
  member: Member
  stats: MemberStats
  access: WeightAccess
}

/** The VS card: both corners with member glows, the score, the win strip and the tale of the tape. */
export function VsCard({ a, b, h2h, unit, viewerId }: { a: VsSide; b: VsSide; h2h: H2H; unit: Unit; viewerId: string | null }) {
  const t = useT(SQ)
  const ca = memberColorVar(a.member.color)
  const cb = memberColorVar(b.member.color)
  const leadText = useLeadText()(h2h, a.member, b.member, viewerId)
  const nameOf = (m: Member) => (m.id === viewerId ? `${m.name} (${t('youLabel')})` : m.name)

  const weightSub = (() => {
    const wa = a.access !== 'hidden' && a.stats.weight ? a.stats.weight.changeKg : null
    const wb = b.access !== 'hidden' && b.stats.weight ? b.stats.weight.changeKg : null
    if (wa == null && wb == null) return null
    const f = (v: number | null) => (v == null ? '—' : `${fmtSigned(kgToUnit(v, unit))} ${unit}`)
    return `${f(wa)} · ${f(wb)}`
  })()

  const who = (s: VsSide) => (
    <div className="sq-vs__who">
      <Avatar member={s.member} size={54} you={s.member.id === viewerId} decorative />
      <b>{s.member.name}</b>
      <span>{weightText(s.stats.weight, s.access, unit) || (s.stats.programWeek ? t('weekShort', { n: s.stats.programWeek }) : ' ')}</span>
    </div>
  )

  return (
    <section className="ui-card sq-vs sq-vs-card" style={{ ['--ca' as string]: ca, ['--cb' as string]: cb }} aria-label={t('mTaleTitle')}>
      <div className="sq-vs__top">
        {who(a)}
        <div className="sq-vs__score">
          <p className="sq-vs__score-v num" aria-label={`${a.member.name} ${h2h.a}, ${b.member.name} ${h2h.b}`}>
            {h2h.a}
            <em aria-hidden="true">–</em>
            {h2h.b}
          </p>
          <p className="sq-vs__score-l">{leadText}</p>
          <WinStrip rows={h2h.rows} a={a.member} b={b.member} label={t('winStrip', { a: a.member.name, na: h2h.a, b: b.member.name, nb: h2h.b })} />
        </div>
        {who(b)}
      </div>
      <ul className="sq-tape">
        {h2h.rows.map((r) => {
          const label = t(METRIC_LABEL[r.key])
          const va = fmtMetric(r.key, r.a, unit)
          const vb = fmtMetric(r.key, r.b, unit)
          return (
            <TapeRow
              key={r.key}
              row={r}
              label={label}
              sub={r.key === 'goal' && weightSub ? weightSub : undefined}
              va={va}
              vb={vb}
              ca={ca}
              cb={cb}
              summary={`${label}: ${nameOf(a.member)} ${va}, ${nameOf(b.member)} ${vb}`}
            />
          )
        })}
      </ul>
    </section>
  )
}
