import { getState, put, remove, update } from '../../data/store'
import type { WeightEntry } from '../../data/types'
import type { ISODate } from '../../lib/dates'
import { dailyId } from '../../lib/ids'

export interface WeighInInput {
  memberId: string
  date: ISODate
  kg: number
  bodyFat: number | null
  waistCm: number | null
  note: string
}

/**
 * Save a weigh-in (one per member per day, so the id is deterministic). When `fromId` is another day's entry
 * (the date was changed while editing), that entry moves to the new day. Returns an undo function.
 */
export function saveWeighIn(input: WeighInInput, fromId?: string | null): () => void {
  const id = dailyId(input.memberId, input.date)
  const weights = getState().weights
  const before = weights[id] ?? null
  const moved = fromId && fromId !== id ? (weights[fromId] ?? null) : null
  const row: WeightEntry = { id, ...input, note: input.note.trim(), updatedAt: 0 }
  put('weights', row)
  if (moved) remove('weights', moved.id)
  return () => {
    if (before) put('weights', before)
    else remove('weights', id)
    if (moved) put('weights', moved)
  }
}

/** Delete a weigh-in; returns an undo function. */
export function deleteWeighIn(id: string): () => void {
  const before = getState().weights[id] ?? null
  remove('weights', id)
  return () => {
    if (before) put('weights', before)
  }
}

/** Set (or clear with null) a member's goal weight, stored in kg. */
export function setGoalWeight(memberId: string, kg: number | null): void {
  update('members', memberId, { goalWeightKg: kg })
}
