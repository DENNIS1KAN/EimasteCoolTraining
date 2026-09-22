import { lazy, Suspense, useId } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader, Skeleton, Tabs } from '../../ui'
import { useT } from '../../i18n'
import { useStore } from '../../data/store'
import { fmtDate } from '../../lib/format'
import { todayISO } from '../../lib/dates'
import { M } from './messages'
import { COACH_TABS as TABS, parseCoachTab, type CoachTab } from './lib/tabs'
import { SquadTab } from './squad/SquadTab'
import { ProgramsTab } from './programs/ProgramsTab'
import './coach.css'

// Built by the fuel feature; loaded only when the tab opens.
const CoachNutritionTab = lazy(() => import('../fuel/CoachNutritionTab'))

/** Coach console: the squad's accountability board, meal plans and programs. */
export default function CoachPage() {
  const t = useT(M)
  const [params, setParams] = useSearchParams()
  const tab = parseCoachTab(params.get('tab'))
  const memberCount = useStore((s) => Object.keys(s.members).length)
  const uid = useId()
  const panelId = (v: CoachTab) => `${uid}-panel-${v}`
  const tabId = (v: CoachTab) => `${uid}-tab-${v}`

  const labels: Record<CoachTab, string> = { squad: t('tabSquad'), nutrition: t('tabNutrition'), programs: t('tabPrograms') }

  return (
    <div className="coach-page">
      <PageHeader eyebrow={t('eyebrow', { members: memberCount, date: fmtDate(todayISO(), 'long') })} title={t('title')} account />
      <Tabs<CoachTab>
        options={TABS.map((v) => ({ value: v, label: labels[v] }))}
        value={tab}
        onChange={(v) => setParams(v === 'squad' ? {} : { tab: v }, { replace: true })}
        ariaLabel={t('tabsLabel')}
        block
        controls={panelId}
        tabId={tabId}
        className="coach-tabs"
      />
      <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} className="coach-panel">
        {tab === 'squad' && <SquadTab />}
        {tab === 'nutrition' && (
          <Suspense fallback={<NutritionFallback />}>
            <CoachNutritionTab />
          </Suspense>
        )}
        {tab === 'programs' && <ProgramsTab />}
      </div>
    </div>
  )
}

function NutritionFallback() {
  return (
    <div className="stack" aria-hidden="true">
      <Skeleton height={120} radius={22} />
      <Skeleton height={220} radius={22} />
    </div>
  )
}
