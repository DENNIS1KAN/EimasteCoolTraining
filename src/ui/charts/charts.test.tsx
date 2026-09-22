import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { fromISODate } from '../../lib/dates'
import { BarChart, ChartTable, DeltaBar, Heatmap, Legend, LineChart, Meter, ProgressRing, Sparkline } from './index'

afterEach(cleanup)

const day = (d: string) => fromISODate(d).getTime()
const fmt = (n: number) => n.toFixed(1)
const fmtDay = (n: number) => new Date(n).toISOString().slice(5, 10)

const race = [
  {
    id: 'stelios',
    label: 'Stelios',
    color: 'var(--m-blue)',
    curve: 'step' as const,
    points: [
      { x: day('2026-09-01'), y: 1 },
      { x: day('2026-09-02'), y: 2 },
      { x: day('2026-09-04'), y: 3 },
    ],
  },
  {
    id: 'thanos',
    label: 'Thanos',
    color: 'var(--m-orange)',
    curve: 'step' as const,
    points: [
      { x: day('2026-09-01'), y: 1 },
      { x: day('2026-09-03'), y: 2 },
      { x: day('2026-09-04'), y: 2 },
    ],
  },
]

describe('LineChart', () => {
  it('renders lines, legend, ticks and an accessible table', () => {
    const { container } = render(<LineChart series={race} formatY={String} formatX={fmtDay} ariaLabel="Workouts race" />)
    expect(screen.getByRole('img', { name: 'Workouts race' })).toBeTruthy()
    expect(container.querySelectorAll('path.ch-line')).toHaveLength(2)
    expect(container.querySelectorAll('.ch-legend__item')).toHaveLength(2)
    expect(container.querySelectorAll('text.ch-tick').length).toBeGreaterThan(2)
    const table = container.querySelector('table')!
    expect(table.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(table.textContent).toContain('Stelios')
  })

  it('moves the crosshair with the keyboard and lists every series', () => {
    const { container } = render(<LineChart series={race} formatY={String} formatX={fmtDay} ariaLabel="Workouts race" />)
    const plot = screen.getByRole('img', { name: 'Workouts race' })
    act(() => plot.focus())
    let tip = container.querySelector('.ch-tip')!
    expect(tip.textContent).toContain('09-04')
    expect(tip.querySelectorAll('.ch-tip__row')).toHaveLength(2)
    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    tip = container.querySelector('.ch-tip')!
    expect(tip.textContent).toContain('09-03')
    // Stelios holds 2 on the 3rd (step curve), Thanos logged his 2nd
    expect([...tip.querySelectorAll('.ch-tip__value')].map((e) => e.textContent)).toEqual(['2', '2'])
    fireEvent.keyDown(plot, { key: 'Home' })
    expect(container.querySelector('.ch-tip')!.textContent).toContain('09-01')
    fireEvent.keyDown(plot, { key: 'Escape' })
    expect(container.querySelector('.ch-tip')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeTruthy()
  })

  it('draws goal lines and markers, and direct-labels a single series without a legend', () => {
    const { container } = render(
      <LineChart
        series={[{ id: 'w', label: 'Trend', color: 'var(--m-blue)', area: true, points: [{ x: day('2026-09-01'), y: 82.4 }, { x: day('2026-09-20'), y: 80.9 }] }]}
        refLines={[{ y: 78, label: 'Goal 78 kg' }]}
        markers={[{ x: day('2026-09-07'), label: 'Program start' }]}
        formatY={fmt}
        formatX={fmtDay}
        ariaLabel="Weight"
      />,
    )
    expect(container.querySelector('.ch-ref')).toBeTruthy()
    expect(container.textContent).toContain('Goal 78 kg')
    expect(container.textContent).toContain('Program start')
    expect(container.querySelector('.ch-area')).toBeTruthy()
    expect(container.querySelector('.ch-legend')).toBeNull()
    expect(container.querySelector('.ch-dl')?.textContent).toBe('80.9')
  })

  it('shows an empty state', () => {
    render(<LineChart series={[]} formatY={fmt} formatX={fmtDay} ariaLabel="Nothing" emptyLabel="Log a weigh-in" />)
    expect(screen.getByText('Log a weigh-in')).toBeTruthy()
  })
})

describe('BarChart', () => {
  it('renders grouped bars with a per-category tooltip', () => {
    const { container } = render(
      <BarChart
        categories={['W1', 'W2', 'W3']}
        series={[
          { id: 's', label: 'Stelios', color: 'var(--m-blue)', values: [10, 12, null] },
          { id: 't', label: 'Thanos', color: 'var(--m-orange)', values: [9, 14, 3] },
        ]}
        formatY={String}
        ariaLabel="Weekly volume"
      />,
    )
    expect(container.querySelectorAll('path.ch-bar')).toHaveLength(5)
    const plot = screen.getByRole('img', { name: 'Weekly volume' })
    act(() => plot.focus())
    const tip = container.querySelector('.ch-tip')!
    expect(tip.textContent).toContain('W3')
    expect(tip.textContent).toContain('–')
    expect(container.querySelectorAll('.ch-legend__item')).toHaveLength(2)
  })

  it('stacks segments with only the outer one rounded', () => {
    const { container } = render(
      <BarChart
        stacked
        categories={['A']}
        series={[
          { id: 'a', label: 'A', color: 'red', values: [5] },
          { id: 'b', label: 'B', color: 'blue', values: [5] },
        ]}
        formatY={String}
        ariaLabel="Stacked"
      />,
    )
    const paths = [...container.querySelectorAll('path.ch-bar')].map((p) => p.getAttribute('d')!)
    expect(paths).toHaveLength(2)
    expect(paths[0]).toContain('A0,0')
    expect(paths[1]).toContain('A4,4')
  })
})

describe('small components', () => {
  it('Sparkline draws a line and an end dot', () => {
    const { container } = render(<Sparkline values={[3, 5, 4, 6]} color="var(--m-aqua)" ariaLabel="Trend" />)
    expect(container.querySelector('.ch-line')).toBeTruthy()
    expect(container.querySelectorAll('circle.ch-dot')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Trend' })).toBeTruthy()
  })

  it('ProgressRing clamps and shows overflow as a second lap', () => {
    const { container, rerender } = render(<ProgressRing value={0.5} ariaLabel="Half">50%</ProgressRing>)
    expect(container.querySelectorAll('.ch-ring__arc')).toHaveLength(1)
    expect(screen.getByText('50%')).toBeTruthy()
    rerender(<ProgressRing value={1.3} ariaLabel="Over" />)
    expect(container.querySelectorAll('.ch-ring__arc')).toHaveLength(2)
    rerender(<ProgressRing value={-1} ariaLabel="None" />)
    expect(container.querySelectorAll('.ch-ring__arc')).toHaveLength(0)
  })

  it('Meter exposes its value and marks overflow', () => {
    const { container, rerender } = render(<Meter value={132} max={180} label="Protein" valueLabel="132 / 180 g" ariaLabel="Protein 132 of 180 g" />)
    const m = screen.getByRole('meter', { name: 'Protein 132 of 180 g' })
    expect(m.getAttribute('aria-valuenow')).toBe('132')
    expect((container.querySelector('.ch-meter__fill') as HTMLElement).style.width).toMatch(/^73\.3/)
    rerender(<Meter value={90} max={60} ariaLabel="Fat" />)
    expect(container.querySelector('.ch-meter__limit')).toBeTruthy()
  })

  it('Heatmap lays out cells, empty outlines and a tooltip', () => {
    const days = Array.from({ length: 21 }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, '0')}`,
      value: i % 5 === 0 ? null : i % 3,
    }))
    const { container } = render(
      <Heatmap days={days} color="var(--m-blue)" ariaLabel="Check-ins" formatTooltip={(d) => `${d.date}: ${d.value ?? 'none'}`} />,
    )
    expect(container.querySelectorAll('rect.ch-cell')).toHaveLength(21)
    expect(container.querySelectorAll('rect.ch-cell--empty')).toHaveLength(5)
    const plot = screen.getByRole('img', { name: 'Check-ins' })
    act(() => plot.focus())
    // 21 Sep 2026 is a Monday (top row) with no check-in
    expect(container.querySelector('.ch-tip')!.textContent).toBe('2026-09-21: none')
    fireEvent.keyDown(plot, { key: 'ArrowUp' }) // no wrap into the previous week
    expect(container.querySelector('.ch-tip')!.textContent).toBe('2026-09-21: none')
    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    expect(container.querySelector('.ch-tip')!.textContent).toBe('2026-09-14: 1')
    fireEvent.keyDown(plot, { key: 'ArrowDown' })
    expect(container.querySelector('.ch-tip')!.textContent).toBe('2026-09-15: 2')
  })

  it('DeltaBar splits by share and emphasises the leader', () => {
    const { container } = render(
      <DeltaBar label="Workouts" a={{ value: 3, color: 'var(--m-blue)', label: 'Stelios' }} b={{ value: 1, color: 'var(--m-orange)', label: 'Thanos' }} format={String} />,
    )
    expect(screen.getByRole('img', { name: 'Workouts: Stelios 3, Thanos 1' })).toBeTruthy()
    const bars = [...container.querySelectorAll<HTMLElement>('.ch-delta__bar')]
    expect(bars.map((b) => b.style.width)).toEqual(['75%', '25%'])
    expect(container.querySelector('.ch-delta__value--a')!.className).toContain('is-lead')
  })

  it('DeltaBar handles zero and missing values', () => {
    const { container } = render(
      <DeltaBar a={{ value: 0, color: 'red', label: 'A' }} b={{ value: null, color: 'blue', label: 'B' }} format={String} />,
    )
    expect(container.querySelectorAll('.ch-delta__bar')).toHaveLength(0)
    expect(container.querySelector('.ch-delta__value--b')!.textContent).toBe('–')
    expect(container.querySelector('.is-lead')).toBeNull()
  })

  it('ChartTable and Legend render plain data', () => {
    render(
      <>
        <Legend items={[{ label: 'Stelios', color: 'var(--m-blue)', kind: 'line' }]} />
        <ChartTable caption="Weights" columns={['Date', 'kg']} rows={[['1 Sep', '82.4'], ['2 Sep', null]]} />
      </>,
    )
    expect(screen.getByText('Stelios')).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Weights' })).toBeTruthy()
    expect(screen.getByText('Data')).toBeTruthy()
  })
})
