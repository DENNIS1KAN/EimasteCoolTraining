import { useMemo, type ReactNode } from 'react'
import { setThemePref, useThemePref, type ThemePref } from '../../app/theme'
import type { WeightEntry } from '../../data/types'
import { setLang, useLang, type Lang } from '../../i18n'
import { addDays, dateRange, diffDays, fromISODate, isoFromMs, startOfWeek, todayISO, type ISODate } from '../../lib/dates'
import { fmtDate, fmtDayLabel, fmtNum, fmtPct, fmtSigned, fmtVolume } from '../../lib/format'
import { weightSeries } from '../../lib/stats'
import { BarChart, DeltaBar, Heatmap, Legend, LineChart, Meter, ProgressRing, Sparkline, type LineSeries } from '../../ui/charts'

/**
 * Chart kit playground (#/dev/charts): every component with realistic squad data.
 * Toggle theme and language in the header; screenshot with colorScheme light/dark for both themes.
 */

const BLUE = 'var(--m-blue)'
const ORANGE = 'var(--m-orange)'
const AQUA = 'var(--m-aqua)'
const SCHEDULE = [0, 1, null, 2, 3, 4, null] // BTS: Upper, Lower, rest, Pull, Push, Legs, rest

/** Deterministic noise so screenshots are stable. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ms = (d: ISODate) => fromISODate(d).getTime()

function weightData(today: ISODate) {
  const r = rng(7)
  const from = addDays(today, -34)
  const entries: WeightEntry[] = dateRange(from, today)
    .filter((d, i) => d === today || r() > 0.14 || i === 0)
    .map((date) => {
      const i = diffDays(from, date)
      const kg = Math.round((82.8 - (1.9 * i) / 34 + (r() - 0.5) * 0.9) * 10) / 10
      return { id: `s__${date}`, memberId: 's', date, kg, bodyFat: null, waistCm: null, note: '', updatedAt: 0 }
    })
  const pts = weightSeries(entries)
  return {
    raw: pts.map((p) => ({ x: ms(p.date), y: p.kg })),
    trend: pts.map((p) => ({ x: ms(p.date), y: Math.round(p.trendKg * 10) / 10 })),
  }
}

function raceData(start: ISODate, today: ISODate, miss: number, seed: number) {
  const r = rng(seed)
  let n = 0
  const pts = [{ x: ms(start), y: 0 }]
  for (const d of dateRange(start, today)) {
    if (SCHEDULE[diffDays(start, d) % 7] == null || r() < miss) continue
    n++
    pts.push({ x: ms(d), y: n })
  }
  if (pts[pts.length - 1].x !== ms(today)) pts.push({ x: ms(today), y: n })
  return pts
}

function benchData(start: ISODate, weeks: number, offset: number, base: number, gain: number, seed: number) {
  const r = rng(seed)
  return Array.from({ length: weeks }, (_, w) => ({
    x: ms(addDays(start, w * 7 + offset)),
    y: Math.round((base + gain * w + (r() - 0.4) * 2) * 2) / 2,
  }))
}

function checkinDays(today: ISODate) {
  const r = rng(11)
  return dateRange(addDays(startOfWeek(today), -77), today).map((date) => {
    const x = r()
    return { date, value: x < 0.08 ? null : x < 0.14 ? 0 : Math.min(1, Math.round((0.2 + r() * 0.95) * 5) / 5) }
  })
}

function volumeDays(start: ISODate, today: ISODate) {
  const r = rng(5)
  return dateRange(start, today).map((date) => {
    const slot = SCHEDULE[diffDays(start, date) % 7]
    return { date, value: slot == null || r() < 0.1 ? 0 : Math.round(2600 + r() * 2400) }
  })
}

const dayMonth = (x: number) => fmtDate(isoFromMs(x), 'dayMonth')
const dayLabel = (x: number) => fmtDayLabel(isoFromMs(x))
const kg1 = (n: number) => `${fmtNum(n, 1)} kg`

export default function ChartsPlayground() {
  const lang = useLang()
  const theme = useThemePref()
  const today = todayISO()
  const start = addDays(startOfWeek(today), -28)
  const d = useMemo(() => {
    const weight = weightData(today)
    const stelios = raceData(start, today, 0.08, 3)
    const thanos = raceData(start, today, 0.22, 9)
    return {
      weight,
      stelios,
      thanos,
      benchS: benchData(start, 5, 0, 84, 1.3, 1),
      benchT: benchData(start, 5, 1, 95, 1.5, 2),
      checkins: checkinDays(today),
      volume: volumeDays(start, today),
    }
  }, [today, start])

  const last = <T,>(a: T[]) => a[a.length - 1]
  const weightSeriesProps: LineSeries[] = [
    { id: 'raw', label: lang === 'el' ? 'Ζύγιση' : 'Daily weigh-in', color: BLUE, points: d.weight.raw, line: false },
    { id: 'trend', label: lang === 'el' ? 'Τάση' : 'Trend', color: BLUE, points: d.weight.trend, area: true },
  ]
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5']
  const weekTitles = weeks.map((_, i) => `${lang === 'el' ? 'Εβδομάδα' : 'Week'} ${i + 1} · ${fmtDate(addDays(start, i * 7), 'dayMonth')}`)

  return (
    <div className="pg">
      <style>{CSS}</style>
      <header className="pg-head">
        <div>
          <div className="pg-eyebrow">Dev playground</div>
          <h1 className="pg-title">Chart kit</h1>
        </div>
        <div className="pg-controls">
          <Segmented<ThemePref> value={theme} options={['system', 'light', 'dark']} onChange={setThemePref} />
          <Segmented<Lang> value={lang} options={['en', 'el']} onChange={setLang} />
        </div>
      </header>

      <section className="pg-tiles">
        <Tile label="Trend weight" value={fmtNum(last(d.weight.trend).y, 1)} unit="kg" delta={`${fmtSigned(last(d.weight.trend).y - d.weight.trend[0].y)} kg`}>
          <Sparkline values={d.weight.trend} color={BLUE} ariaLabel={`Trend weight from ${kg1(d.weight.trend[0].y)} to ${kg1(last(d.weight.trend).y)}`} />
        </Tile>
        <Tile label="Sessions" value={String(last(d.stelios).y)} unit="done" delta="+4 this week">
          <Sparkline values={d.stelios.map((p) => p.y)} color={BLUE} area={false} ariaLabel="Cumulative sessions" />
        </Tile>
        <Tile label="Bench e1RM" value={fmtNum(last(d.benchT).y, 1)} unit="kg" delta="+6.5 kg">
          <Sparkline values={d.benchT} color={ORANGE} ariaLabel="Bench estimated 1RM" />
        </Tile>
      </section>

      <div className="pg-grid">
        <Card eyebrow="Body · Stelios" title="Weight trend, 5 weeks">
          <LineChart
            series={weightSeriesProps}
            refLines={[{ y: 78, label: `${lang === 'el' ? 'Στόχος' : 'Goal'} ${kg1(78)}` }]}
            markers={[{ x: ms(start), label: lang === 'el' ? 'Έναρξη' : 'Program start' }]}
            formatY={(n) => fmtNum(n, 1)}
            formatTooltipY={kg1}
            formatX={dayMonth}
            formatTooltipX={dayLabel}
            ariaLabel={`Stelios weight: trend ${kg1(d.weight.trend[0].y)} to ${kg1(last(d.weight.trend).y)} over 5 weeks, goal 78 kg`}
          />
        </Card>

        <Card eyebrow="The race" title="Sessions, cumulative">
          <LineChart
            series={[
              { id: 's', label: 'Stelios', color: BLUE, points: d.stelios, curve: 'step' },
              { id: 't', label: 'Thanos', color: ORANGE, points: d.thanos, curve: 'step' },
            ]}
            zeroBaseline
            formatY={(n) => fmtNum(n, 0)}
            formatX={dayMonth}
            formatTooltipX={dayLabel}
            ariaLabel={`Cumulative sessions: Stelios ${last(d.stelios).y}, Thanos ${last(d.thanos).y}`}
          />
        </Card>

        <Card eyebrow="Training volume" title="Weekly volume">
          <BarChart
            categories={weeks}
            categoryTitles={weekTitles}
            series={[
              { id: 's', label: 'Stelios', color: BLUE, values: [14200, 16800, 17900, 18400, 9600] },
              { id: 't', label: 'Thanos', color: ORANGE, values: [15100, 17200, 19800, 21100, 11800] },
            ]}
            formatY={(n) => `${fmtNum(n / 1000, 0)} t`}
            formatTooltipY={(n) => fmtVolume(n, 'kg')}
            ariaLabel="Weekly training volume, Stelios and Thanos, weeks 1 to 5"
          />
        </Card>

        <Card eyebrow="Strength" title="Bench press e1RM · kg">
          <LineChart
            series={[
              { id: 's', label: 'Stelios', color: BLUE, points: d.benchS, dots: 'all' },
              { id: 't', label: 'Thanos', color: ORANGE, points: d.benchT, dots: 'all' },
            ]}
            formatY={(n) => fmtNum(n, 0)}
            formatTooltipY={kg1}
            formatX={dayMonth}
            formatTooltipX={dayLabel}
            ariaLabel="Bench press estimated one-rep max by week for Stelios and Thanos"
          />
        </Card>

        <Card eyebrow="Consistency" title="On schedule by week · Stelios highlighted">
          <LineChart
            xType="linear"
            series={[
              { id: 's', label: 'Stelios', color: BLUE, emphasis: true, points: [100, 100, 80, 100, 92].map((y, i) => ({ x: i + 1, y })) },
              { id: 't', label: 'Thanos', color: ORANGE, points: [80, 100, 60, 80, 79].map((y, i) => ({ x: i + 1, y })) },
              { id: 'd', label: 'Dennis', color: AQUA, points: [60, 80, 80, 60, 70].map((y, i) => ({ x: i + 1, y })) },
            ]}
            yDomain={[0, 100]}
            height={200}
            formatY={(n) => `${fmtNum(n, 0)}%`}
            formatX={(n) => `W${n}`}
            formatTooltipX={(n) => `${lang === 'el' ? 'Εβδομάδα' : 'Week'} ${n}`}
            xLabel={lang === 'el' ? 'Εβδομάδα' : 'Week'}
            ariaLabel="Share of scheduled sessions done per week"
          />
        </Card>

        <Card eyebrow="12-week program" title="Weekly volume, dense">
          <BarChart
            categories={Array.from({ length: 12 }, (_, i) => `W${i + 1}`)}
            series={[
              { id: 's', label: 'Stelios', color: BLUE, values: [14.2, 16.8, 17.9, 18.4, 19.1, 20.3, 12.5, 21.4, null, null, null, null] },
              { id: 't', label: 'Thanos', color: ORANGE, values: [15.1, 17.2, 19.8, 21.1, 20.2, 22.8, 13.0, 23.9, null, null, null, null] },
            ]}
            height={180}
            formatY={(n) => `${fmtNum(n, 0)} t`}
            formatTooltipY={(n) => `${fmtNum(n, 1)} t`}
            ariaLabel="Weekly volume across the 12-week program"
          />
        </Card>

        <Card eyebrow="Tale of the tape" title="Stelios vs Thanos">
          <div className="pg-tape-head">
            <Legend items={[{ label: 'Stelios', color: BLUE }]} />
            <Legend items={[{ label: 'Thanos', color: ORANGE }]} />
          </div>
          <DeltaBar label="Workouts done" a={{ value: 13, color: BLUE, label: 'Stelios' }} b={{ value: 11, color: ORANGE, label: 'Thanos' }} format={(n) => fmtNum(n, 0)} />
          <DeltaBar label="On schedule" a={{ value: 0.92, color: BLUE, label: 'Stelios' }} b={{ value: 0.79, color: ORANGE, label: 'Thanos' }} format={(n) => fmtPct(n)} />
          <DeltaBar label="Week streak" a={{ value: 3, color: BLUE, label: 'Stelios' }} b={{ value: 1, color: ORANGE, label: 'Thanos' }} format={(n) => `${n} wk`} />
          <DeltaBar label="Volume this week" a={{ value: 18400, color: BLUE, label: 'Stelios' }} b={{ value: 21100, color: ORANGE, label: 'Thanos' }} format={(n) => fmtVolume(n, 'kg')} />
          <DeltaBar label="Strength gain" a={{ value: 8.2, color: BLUE, label: 'Stelios' }} b={{ value: 6.9, color: ORANGE, label: 'Thanos' }} format={(n) => `${fmtSigned(n)}%`} />
          <DeltaBar label="Goal progress" a={{ value: 0.34, color: BLUE, label: 'Stelios' }} b={{ value: 0.4, color: ORANGE, label: 'Thanos' }} format={(n) => fmtPct(n)} />
          <DeltaBar label="PRs" a={{ value: 7, color: BLUE, label: 'Stelios' }} b={{ value: 7, color: ORANGE, label: 'Thanos' }} format={(n) => fmtNum(n, 0)} />
          <DeltaBar label="Nutrition (no plan yet)" a={{ value: null, color: BLUE, label: 'Stelios' }} b={{ value: 0.71, color: ORANGE, label: 'Thanos' }} format={(n) => fmtPct(n)} />
          <DeltaBar label="Kudos this week" a={{ value: 0, color: BLUE, label: 'Stelios' }} b={{ value: 0, color: ORANGE, label: 'Thanos' }} format={(n) => fmtNum(n, 0)} />
        </Card>

        <Card eyebrow="Fuel" title="Rings & meters">
          <div className="pg-rings">
            <Ring value={0.34} label="Goal" color={BLUE} center={fmtPct(0.34)} />
            <Ring value={3 / 5} label="This week" color={ORANGE} center="3/5" />
            <Ring value={1.25} label="Water" color={AQUA} center={fmtPct(1.25)} />
            <Ring value={0} label="Kudos" center="0" />
          </div>
          <div className="pg-rings">
            <ProgressRing value={1630 / 2400} size={108} stroke={10} ariaLabel="1,630 of 2,400 kcal eaten">
              <b className="pg-ring-big">770</b>
              <span className="pg-ring-cap">kcal left</span>
            </ProgressRing>
            <div className="pg-meters">
              <Meter label="Protein" valueLabel="132 / 180 g" value={132} max={180} ariaLabel="Protein 132 of 180 g" />
              <Meter label="Carbs" valueLabel="170 / 250 g" value={170} max={250} ariaLabel="Carbs 170 of 250 g" />
              <Meter label="Fat" valueLabel="78 / 70 g" value={78} max={70} ariaLabel="Fat 78 of 70 g, over target" />
              <Meter label="Water" valueLabel="1.8 / 3 L" value={1.8} max={3} color={AQUA} ariaLabel="Water 1.8 of 3 litres" />
            </div>
          </div>
        </Card>

        <Card eyebrow="Fuel · 12 weeks" title="Meal plan check-ins">
          <Heatmap
            days={d.checkins}
            color={AQUA}
            weekStartsMonday
            valueLabel="On plan"
            formatValue={(n) => fmtPct(n)}
            formatTooltip={(x) => `${fmtDayLabel(x.date)} · ${x.value == null ? 'no check-in' : `${fmtPct(x.value)} on plan`}`}
            ariaLabel="Daily meal plan adherence over the last 12 weeks"
          />
        </Card>

        <Card eyebrow="Train · since program start" title="Daily volume">
          <Heatmap
            days={d.volume}
            color={BLUE}
            weekStartsMonday
            valueLabel="Volume"
            formatValue={(n) => fmtVolume(n, 'kg')}
            formatTooltip={(x) => `${fmtDayLabel(x.date)} · ${x.value ? fmtVolume(x.value, 'kg') : 'rest'}`}
            ariaLabel="Training volume per day since the program started"
          />
        </Card>

        <Card eyebrow="Edge cases" title="Empty, single point, four series">
          <LineChart series={[]} height={120} formatY={String} formatX={dayMonth} ariaLabel="No weigh-ins yet" emptyLabel="Log your first weigh-in to see the trend" />
          <div style={{ height: 16 }} />
          <LineChart
            series={[{ id: 'one', label: 'Weight', color: BLUE, points: [{ x: ms(today), y: 80.6 }] }]}
            height={140}
            formatY={(n) => fmtNum(n, 1)}
            formatTooltipY={kg1}
            formatX={dayMonth}
            ariaLabel="A single weigh-in"
          />
          <div style={{ height: 16 }} />
          <LineChart
            series={[BLUE, ORANGE, AQUA, 'var(--m-yellow)'].map((color, k) => ({
              id: String(k),
              label: ['Stelios', 'Thanos', 'Dennis', 'Guest'][k],
              color,
              points: [0, 1, 2, 3, 4, 5].map((i) => ({ x: ms(addDays(start, i * 7)), y: 50 + i * (6 + k) + (k === 3 ? 0 : k * 2) })),
            }))}
            height={180}
            formatY={(n) => fmtNum(n, 0)}
            formatX={dayMonth}
            ariaLabel="Four converging series"
          />
        </Card>
      </div>
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="pg-seg" role="group">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="pg-card">
      <div className="pg-eyebrow">{eyebrow}</div>
      <h2 className="pg-card-title">{title}</h2>
      {children}
    </section>
  )
}

function Tile({ label, value, unit, delta, children }: { label: string; value: string; unit: string; delta: string; children: ReactNode }) {
  return (
    <div className="pg-tile">
      <div className="pg-eyebrow">{label}</div>
      <div className="pg-tile-value">
        {value}
        <small>{unit}</small>
      </div>
      <div className="pg-tile-delta">{delta}</div>
      {children}
    </div>
  )
}

function Ring({ value, label, color, center }: { value: number; label: string; color?: string; center: string }) {
  return (
    <div className="pg-ring">
      <ProgressRing value={value} color={color} ariaLabel={`${label}: ${center}`}>
        <b className="pg-ring-val">{center}</b>
      </ProgressRing>
      <span className="pg-ring-cap">{label}</span>
    </div>
  )
}

const CSS = `
.pg { max-width: 1160px; margin: 0 auto; padding: 20px 16px 48px; }
.pg-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.pg-title { margin: 2px 0 0; font: 800 34px/1 var(--font-display); letter-spacing: -0.01em; }
.pg-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pg-controls { display: flex; gap: 8px; flex-wrap: wrap; }
.pg-seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-pill); }
.pg-seg button { border: 0; background: transparent; padding: 6px 12px; border-radius: var(--r-pill); font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--ink-2); cursor: pointer; }
.pg-seg button[aria-pressed='true'] { background: var(--ink); color: var(--surface); }
.pg-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
.pg-tile { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 12px 12px 10px; min-width: 0; }
.pg-tile-value { margin: 6px 0 2px; font: 800 30px/1 var(--font-display); }
.pg-tile-value small { margin-left: 3px; font: 700 12px/1 var(--font-body); color: var(--muted); }
.pg-tile-delta { font-size: 11.5px; font-weight: 600; color: var(--ink-2); margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; align-items: start; }
@media (max-width: 420px) { .pg-grid { grid-template-columns: minmax(0, 1fr); } }
.pg-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 16px; min-width: 0; }
.pg-card-title { margin: 4px 0 14px; font-size: 16px; font-weight: 700; }
.pg-tape-head { display: flex; justify-content: space-between; padding-bottom: 8px; margin-bottom: 4px; border-bottom: 1px solid var(--line); }
.pg-rings { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 20px; margin-bottom: 16px; }
.pg-ring { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pg-ring-val { font: 800 16px/1 var(--font-display); }
.pg-ring-big { font: 800 30px/.9 var(--font-display); }
.pg-ring-cap { margin-top: 4px; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pg-meters { flex: 1 1 180px; display: grid; gap: 12px; min-width: 0; }
`
