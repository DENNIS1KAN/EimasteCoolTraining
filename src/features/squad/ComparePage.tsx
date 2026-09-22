import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import { logsOf } from '../../lib/stats'
import { Card, EmptyState, Icon, PageHeader } from '../../ui'
import { useAllTimePoints, useSquad } from './hooks'
import { useHeadToHead } from './components/score'
import { LiftDuel, RaceChart, VolumeChart, WeightDuel } from './compare/CompareCharts'
import { PairPicker } from './compare/PairPicker'
import { useSummaryText } from './compare/summary'
import { VsCard } from './compare/VsCard'
import { liftTallies, summaryClauses } from './logic/compare'
import { resolvePair } from './logic/pair'
import { weightAccess } from './logic/visibility'
import { SQ } from './messages'
import './squad.css'

/** Head to head (/squad/compare?a=<slug>&b=<slug>): VS card, tale of the tape and four duel charts. */
export default function ComparePage() {
  const t = useT(SQ)
  const { me, today, data, stats, competitors } = useSquad()
  const [params, setParams] = useSearchParams()
  const allTime = useAllTimePoints(data, competitors)
  const pair = resolvePair(competitors, me, params.get('a'), params.get('b'), allTime)
  const a = pair?.[0] ?? null
  const b = pair?.[1] ?? null
  const h2h = useHeadToHead(stats, a, b)
  const summaryText = useSummaryText()
  const unit = me?.settings.unit ?? 'kg'

  const clauses = useMemo(() => {
    if (!a || !b || !h2h) return []
    const tallies = liftTallies(logsOf(data, a.id), logsOf(data, b.id), data.programs)
    const side = me?.id === a.id ? 'a' : me?.id === b.id ? 'b' : null
    return summaryClauses(h2h.rows, tallies, side)
  }, [a, b, h2h, data, me?.id])
  const summary = a && b ? summaryText(clauses, a, b, me?.id) : ''

  const setPair = (x: Member, y: Member) => {
    const next = new URLSearchParams(params)
    next.set('a', x.slug)
    next.set('b', y.slug)
    setParams(next, { replace: true })
  }

  const header = <PageHeader back="/squad" eyebrow={t('compareEyebrow')} title={t('compareTitle')} />

  if (!a || !b || !h2h) {
    return (
      <div className="stack sq-page">
        {header}
        <EmptyState icon="swap" title={t('needTwoTitle')} body={t('needTwoBody')} />
      </div>
    )
  }

  const accessA = weightAccess(a, me)
  const accessB = weightAccess(b, me)
  const duo = { a, b, data, today }
  // Nothing logged by either yet: one friendly card instead of four empty charts.
  const quiet = ![a, b].some((m) => Object.values(data.logs).some((l) => l.memberId === m.id && l.done) || Object.values(data.weights).some((w) => w.memberId === m.id))
  return (
    <div className="stack sq-page sq-compare">
      {header}
      <PairPicker a={a} b={b} options={competitors} viewerId={me?.id ?? null} onChange={setPair} />
      <div className="sq-compare__grid">
        <div className="stack sq-compare__main">
          <VsCard
            a={{ member: a, stats: stats[a.id], access: accessA }}
            b={{ member: b, stats: stats[b.id], access: accessB }}
            h2h={h2h}
            unit={unit}
            viewerId={me?.id ?? null}
          />
          {summary || quiet ? (
            <p className="sq-summary" aria-live="polite">
              <Icon name="sparkles" size={16} />
              <span>{summary || t('compareEmpty')}</span>
            </p>
          ) : null}
        </div>
        {quiet ? (
          <Card className="sq-compare__charts">
            <EmptyState compact icon="flame" title={t('raceEmpty')} body={t('compareEmptyBody')} />
          </Card>
        ) : (
          <div className="stack sq-compare__charts">
            <div className="sq-compare__two">
              <RaceChart {...duo} />
              <VolumeChart {...duo} unit={unit} />
            </div>
            <LiftDuel {...duo} unit={unit} accessA={accessA} accessB={accessB} />
            <WeightDuel {...duo} accessA={accessA} accessB={accessB} />
          </div>
        )}
      </div>
    </div>
  )
}
