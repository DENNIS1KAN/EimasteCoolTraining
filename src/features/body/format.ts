import type { Unit } from '../../data/types'
import { fmtNum, fmtSigned } from '../../lib/format'
import { kgToUnit } from '../../lib/units'

/** "80.9" in the viewer's unit, always with one decimal (numbers on this screen line up). */
export const wNum = (kg: number, unit: Unit): string => fmtNum(kgToUnit(kg, unit), 1, 1)

/** "80.9 kg" */
export const wText = (kg: number, unit: Unit): string => `${wNum(kg, unit)} ${unit}`

/** "1.5 kg" (absolute change) */
export const wAbs = (kgDelta: number, unit: Unit): string => `${fmtNum(Math.abs(kgToUnit(kgDelta, unit)), 1, 1)} ${unit}`

/** "−1.5 kg" / "+0.3 kg" */
export const wSigned = (kgDelta: number, unit: Unit): string => `${fmtSigned(kgToUnit(kgDelta, unit), 1)} ${unit}`

/** "−1.8%" from a ratio. */
export const pctSigned = (ratio: number, digits = 1): string => `${fmtSigned(ratio * 100, digits)}%`
