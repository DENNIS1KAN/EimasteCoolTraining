import { useEffect, useRef, useState } from 'react'
import type { Program } from '../../data/types'
import { useT } from '../../i18n'
import { fmtPct } from '../../lib/format'
import { cx } from '../../ui'
import { textLang } from './logic/format'
import { blockGroups } from './logic/program'
import { M } from './messages'
import { useBlockLabel } from './programText'
import { scrollBehavior } from './scroll'

interface Props {
  program: Program
  /** Selected week (1-based). */
  week: number
  /** Calendar week of the program today (0 = not started). */
  currentWeek: number
  completion: number[]
  onSelect: (week: number) => void
}

const CHIP = 44
const GAP = 6

/** Program weeks 1–12 with completion bars and block labels ("FOUNDATION", "RAMPING"); scrolls sideways. */
export function WeekStrip({ program, week, currentWeek, completion, onSelect }: Props) {
  const t = useT(M)
  const scroller = useRef<HTMLDivElement>(null)
  const groups = blockGroups(program)
  const blockLabel = useBlockLabel()
  const [overflows, setOverflows] = useState(true)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    // Fade the right edge only while there is more to scroll to.
    const check = () => setOverflows(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    ro?.observe(el)
    el.addEventListener('scroll', check, { passive: true })
    return () => {
      ro?.disconnect()
      el.removeEventListener('scroll', check)
    }
  }, [])

  useEffect(() => {
    const el = scroller.current
    const chip = el?.querySelector<HTMLElement>(`[data-week="${week}"]`)
    if (!el || !chip) return
    const left = chip.offsetLeft - el.clientWidth / 2 + chip.offsetWidth / 2
    el.scrollTo?.({ left: Math.max(0, left), behavior: scrollBehavior() })
  }, [week])

  return (
    <div className="tr-weeks">
      <div className={cx('tr-weeks__scroll', overflows && 'is-overflow')} ref={scroller}>
        <div className="tr-weeks__blocks" aria-hidden="true">
          {groups.map((g) => (
            <span key={g.from} className="tr-weeks__block" lang={textLang(blockLabel(g.label))} style={{ width: (g.to - g.from + 1) * (CHIP + GAP) - GAP }}>
              {blockLabel(g.label)}
            </span>
          ))}
        </div>
        <div className="tr-weeks__row" role="group" aria-label={t('programWeek')}>
          {program.weeks.map((_, i) => {
            const n = i + 1
            const c = completion[i] ?? 0
            return (
              <button
                key={n}
                type="button"
                data-week={n}
                className={cx('tr-wk', n === week && 'is-sel', c >= 1 && 'is-done', n === currentWeek && 'is-now')}
                aria-pressed={n === week}
                aria-label={t('weekChip', { n, pct: fmtPct(c) })}
                onClick={() => onSelect(n)}
              >
                <b className="num">{n}</b>
                <span className="tr-wk__bar">
                  <i style={{ width: `${Math.round(c * 100)}%` }} />
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
