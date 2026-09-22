import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useMe, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { AvatarStack, PageHeader, Segmented } from '../../ui'
import { programWeekOn } from '../../lib/stats'
import { useToday } from './hooks'
import { SQ } from './messages'
import { FeedTab } from './feed/FeedTab'
import { LeagueTab } from './league/LeagueTab'
import { OverviewTab } from './overview/OverviewTab'
import './squad.css'

type Tab = 'overview' | 'league' | 'feed'
const TABS: Tab[] = ['overview', 'league', 'feed']

/** Everyone's progress: this week at a glance, the league and the activity feed (?tab=overview|league|feed). */
export default function SquadPage() {
  const t = useT(SQ)
  const me = useMe()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as Tab | null
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'overview'
  const members = useStore((s) => s.members)
  const programs = useStore((s) => s.programs)
  const list = useMemo(
    () => Object.values(members).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'athlete' ? -1 : 1)),
    [members],
  )

  const eyebrow = useMemo(() => {
    const parts = [t('membersN', { n: list.length })]
    const program = me?.programId ? programs[me.programId] : undefined
    if (program && me?.programStart) {
      const w = programWeekOn(program, me.programStart, today)
      if (w > 0) parts.push(t('programWeek', { program: program.name.split(' ')[0], n: w }))
    }
    return parts.join(' · ')
  }, [list.length, me, programs, today, t])

  const setTab = (v: Tab) => {
    const next = new URLSearchParams(params)
    if (v === 'overview') next.delete('tab')
    else next.set('tab', v)
    setParams(next, { replace: true })
  }

  return (
    <div className="stack sq-page">
      <PageHeader
        eyebrow={eyebrow}
        title={t('squadTitle')}
        account
        actions={list.length > 1 ? <AvatarStack members={list} size={32} max={4} className="sq-page__stack" /> : undefined}
      />
      <Segmented
        mode="tabs"
        block
        ariaLabel={t('tabsLabel')}
        value={tab}
        onChange={setTab}
        tabId={(v) => `sq-tab-${v}`}
        controls={(v) => `sq-panel-${v}`}
        options={[
          { value: 'overview', label: t('tabOverview') },
          { value: 'league', label: t('tabLeague') },
          { value: 'feed', label: t('tabFeed') },
        ]}
      />
      <div role="tabpanel" id={`sq-panel-${tab}`} aria-labelledby={`sq-tab-${tab}`} className="sq-panel">
        {tab === 'overview' ? <OverviewTab /> : tab === 'league' ? <LeagueTab /> : <FeedTab />}
      </div>
    </div>
  )
}
