import { useState } from 'react'
import { useMe, useStore } from '../../data/store'
import type { WeightEntry } from '../../data/types'
import { useT } from '../../i18n'
import { PageHeader, Segmented, useIsDesktop } from '../../ui'
import { BodyHero } from './BodyHero'
import { EmptyHero } from './EmptyHero'
import { GoalCard } from './GoalCard'
import { HistoryList } from './HistoryList'
import { useWeightModel } from './hooks'
import { RANGES, stepperStart, type Range } from './logic'
import { M } from './messages'
import { QuickLogDock } from './QuickLogDock'
import { SquadWeightCard } from './SquadWeightCard'
import { TipsCard } from './TipsCard'
import { WeightChartCard } from './WeightChartCard'
import { WeightEntrySheet } from './WeightEntrySheet'
import './body.css'

const RANGE_KEY = 'ect-body-range'
const readRange = (): Range => {
  try {
    const v = localStorage.getItem(RANGE_KEY)
    return RANGES.includes(v as Range) ? (v as Range) : '1M'
  } catch {
    return '1M'
  }
}

/** Weight tracking: trend hero, goal, chart, quick log, history and the squad race. */
export default function BodyPage() {
  const t = useT(M)
  const me = useMe()
  const model = useWeightModel(me)
  const programs = useStore((s) => s.programs)
  const program = me?.programId ? (programs[me.programId] ?? null) : null
  const wide = useIsDesktop()
  const [range, setRangeState] = useState<Range>(readRange)
  const [edit, setEdit] = useState<{ open: boolean; entry: WeightEntry | null }>({ open: false, entry: null })

  if (!me) return null
  const unit = me.settings.unit
  const setRange = (r: Range) => {
    setRangeState(r)
    try {
      localStorage.setItem(RANGE_KEY, r)
    } catch {
      /* per-device convenience only */
    }
  }

  const n = model.series.length
  const eyebrow = model.phase ? `${me.name} · ${t(`phase_${model.phase}`)}` : me.name
  const rangeTabs =
    n >= 2 ? (
      <Segmented<Range>
        size="sm"
        ariaLabel={t('range')}
        value={range}
        onChange={setRange}
        options={RANGES.map((r) => ({ value: r, label: t(`range_${r}`) }))}
        className="body-range"
      />
    ) : undefined

  const hero = model.stats ? <BodyHero model={model} unit={unit} /> : <EmptyHero member={me} wide={wide} />
  const goal = <GoalCard member={me} model={model} editable />
  const chart = n > 0 ? <WeightChartCard member={me} model={model} range={range} program={program} height={wide ? 260 : 188} /> : null
  const tips = n < 7 ? <TipsCard dismissible={n > 0} /> : null
  const history = <HistoryList entries={model.entries} unit={unit} phase={model.phase} onEdit={(entry) => setEdit({ open: true, entry })} />
  const squad = <SquadWeightCard range={range} today={model.today} height={wide ? 220 : 176} />
  const dock = <QuickLogDock member={me} model={model} variant={wide ? 'card' : 'dock'} />

  return (
    <div className="body-page">
      <PageHeader eyebrow={eyebrow} title={t('title')} actions={rangeTabs} />
      {wide ? (
        <div className="body-layout body-layout--wide">
          <div className="body-col">
            {hero}
            {goal}
            {chart}
            {squad}
          </div>
          <div className="body-col body-col--side">
            {dock}
            {tips}
            {history}
          </div>
        </div>
      ) : (
        <div className="body-layout">
          {hero}
          {goal}
          {n === 0 ? tips : null}
          {chart}
          {n > 0 ? tips : null}
          {history}
          {squad}
          {dock}
        </div>
      )}
      <WeightEntrySheet
        open={edit.open}
        onClose={() => setEdit((s) => ({ ...s, open: false }))}
        memberId={me.id}
        unit={unit}
        entry={edit.entry}
        startValue={stepperStart(model.latest?.kg, unit)}
      />
    </div>
  )
}
