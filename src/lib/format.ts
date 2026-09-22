import type { Unit } from '../data/types'
import { getLang, localeOf } from '../i18n'
import { fromISODate, todayISO, addDays, type ISODate } from './dates'
import { kgToUnit } from './units'

/** Locale-aware number: 80.9 / 80,9. */
export function fmtNum(n: number, maxDigits = 1, minDigits = 0): string {
  return new Intl.NumberFormat(localeOf(getLang()), {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: minDigits,
  }).format(n)
}

/** Compact: 1,284 / 12.9K / 1.2M */
export function fmtCompact(n: number): string {
  return new Intl.NumberFormat(localeOf(getLang()), { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/** Signed with a real minus sign: +1.2 / −0.8 / 0 */
export function fmtSigned(n: number, maxDigits = 1): string {
  const r = Number(n.toFixed(maxDigits))
  if (r === 0) return fmtNum(0, maxDigits)
  return (r > 0 ? '+' : '−') + fmtNum(Math.abs(r), maxDigits)
}

export const fmtPct = (ratio: number, digits = 0): string => fmtNum(ratio * 100, digits) + '%'

/** Body weight stored in kg, displayed in the member's unit: "80.9 kg". */
export function fmtWeight(kg: number, unit: Unit, digits = 1): string {
  return `${fmtNum(kgToUnit(kg, unit), digits)} ${unit}`
}

/** Training volume (kg) in tonnes when large: "18.4 t" / "950 kg" (or lb). */
export function fmtVolume(kg: number, unit: Unit): string {
  // Thresholds compare the rounded value, so 999.6 kg reads "1 t" rather than "1,000 kg".
  if (unit === 'lb') {
    const lb = kgToUnit(kg, 'lb')
    return Math.round(lb) >= 10000 ? `${fmtNum(lb / 1000, 1)}k lb` : `${fmtNum(lb, 0)} lb`
  }
  return Math.round(kg) >= 1000 ? `${fmtNum(kg / 1000, 1)} t` : `${fmtNum(kg, 0)} kg`
}

type DateStyle = 'short' | 'medium' | 'long' | 'weekday' | 'dayMonth'
/** Format an ISO date: short "22/9", dayMonth "22 Sep", medium "22 Sep 2026", long "Tuesday 22 September", weekday "Tue". */
export function fmtDate(d: ISODate, style: DateStyle = 'dayMonth'): string {
  const date = fromISODate(d)
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'numeric' }
      : style === 'medium'
        ? { day: 'numeric', month: 'short', year: 'numeric' }
        : style === 'long'
          ? { weekday: 'long', day: 'numeric', month: 'long' }
          : style === 'weekday'
            ? { weekday: 'short' }
            : { day: 'numeric', month: 'short' }
  // CLDR's en-GB short month for September is "Sept"; keep every short month at three letters.
  return new Intl.DateTimeFormat(localeOf(getLang()), opts).format(date).replace(/\bSept\b/, 'Sep')
}

/** "Today" / "Yesterday" / "Tue 22 Sep" */
export function fmtDayLabel(d: ISODate, now: Date = new Date()): string {
  const today = todayISO(now)
  const el = getLang() === 'el'
  if (d === today) return el ? 'Σήμερα' : 'Today'
  if (d === addDays(today, -1)) return el ? 'Χθες' : 'Yesterday'
  return new Intl.DateTimeFormat(localeOf(getLang()), { weekday: 'short', day: 'numeric', month: 'short' }).format(fromISODate(d))
}

/** "2 h ago", "πριν από 2 ώρες" */
export function fmtRelative(ms: number, now: number = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(localeOf(getLang()), { numeric: 'auto', style: 'short' })
  const s = Math.round((ms - now) / 1000)
  if (Math.abs(s) < 60) return rtf.format(0, 'second')
  // Pick the unit from the rounded amount, so 59 min 50 s reads "1 hr ago", not "60 min ago".
  const units: [Intl.RelativeTimeFormatUnit, number, number][] = [
    ['minute', 60, 60],
    ['hour', 3600, 24],
    ['day', 86400, 7],
    ['week', 86400 * 7, 5],
  ]
  for (const [unit, secs, max] of units) {
    const n = Math.round(s / secs)
    if (Math.abs(n) < max) return rtf.format(n, unit)
  }
  return rtf.format(Math.round(s / (86400 * 30)), 'month')
}

/** 3725000 ms -> "1:02:05"; 65000 -> "1:05" */
export function fmtClock(ms: number): string {
  const t = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

/** 3900000 -> "1 h 5 min" / "65 min" style short duration */
export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}
