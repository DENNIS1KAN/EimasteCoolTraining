import type { Cheer, FileRef } from '../../data/types'
import { dayShortName } from '../../data/programs'
import type { ISODate } from '../dates'
import { addDays, fromISODate, startOfWeek } from '../dates'
import { earnedBadges, type BadgeId } from './badges'
import { logTime, personalRecords, sessionSummary, type PR, type SessionSummary } from './lifts'
import { logsOf, weightsOf, type SquadData } from './member'

interface Base {
  /** Stable id; kudos reference it via Cheer.ref. */
  id: string
  memberId: string
  at: number
}
export type FeedItem =
  | (Base & { kind: 'workout'; logId: string; programId: string; week: number; day: number; dayName: string; summary: SessionSummary; prs: PR[]; feel: number | null; note: string })
  | (Base & { kind: 'weighin'; weekStart: ISODate; date: ISODate; kg: number; changeKg: number | null })
  | (Base & { kind: 'badge'; badge: BadgeId })
  | (Base & { kind: 'nudge' | 'message'; toId: string; emoji: string; text: string; cheerId: string })
  | (Base & { kind: 'plan'; planId: string; title: string; byId: string })
  /** Something a person wrote in the squad chat, as opposed to something the app noticed. */
  | (Base & { kind: 'post'; postId: string; text: string; photos: FileRef[]; editedAt: number | null })

/**
 * Squad activity, newest first. Weigh-ins are summarised as one item per member per week (the week's last
 * weigh-in and its change vs. the previous week), so daily weighing doesn't flood the feed.
 */
export function buildFeed(d: SquadData, opts: { memberId?: string; since?: number; limit?: number } = {}): FeedItem[] {
  const items: FeedItem[] = []
  const members = Object.values(d.members).filter((m) => !opts.memberId || m.id === opts.memberId)
  for (const m of members) {
    const logs = logsOf(d, m.id)
    const prs = personalRecords(logs, d.programs)
    for (const l of logs) {
      if (!l.done) continue
      const p = d.programs[l.programId]
      const day = p?.weeks[l.week - 1]?.days[l.day]
      items.push({
        kind: 'workout',
        id: `workout:${l.id}`,
        memberId: m.id,
        at: logTime(l),
        logId: l.id,
        programId: l.programId,
        week: l.week,
        day: l.day,
        dayName: day ? dayShortName(day) : '',
        summary: sessionSummary(l, p),
        prs: prs.filter((x) => x.logId === l.id),
        feel: l.feel,
        note: l.note,
      })
    }
    if (m.settings.weightVisibility !== 'private') {
      const byWeek = new Map<ISODate, { date: ISODate; kg: number; at: number }>()
      for (const w of weightsOf(d, m.id)) {
        const wk = startOfWeek(w.date)
        const cur = byWeek.get(wk)
        if (!cur || w.date > cur.date) byWeek.set(wk, { date: w.date, kg: w.kg, at: w.updatedAt })
      }
      for (const [wk, w] of byWeek) {
        const prev = byWeek.get(addDays(wk, -7))
        // When it was logged (updatedAt), kept within that calendar day (back-dated entries show on their own day).
        const dayStart = fromISODate(w.date).getTime() - 12 * 3600000
        const at = Math.min(Math.max(w.at, dayStart), dayStart + 24 * 3600000 - 1)
        items.push({ kind: 'weighin', id: `weighin:${m.id}:${wk}`, memberId: m.id, at, weekStart: wk, date: w.date, kg: w.kg, changeKg: prev ? w.kg - prev.kg : null })
      }
    }
    for (const b of earnedBadges(d, m.id)) items.push({ kind: 'badge', id: `badge:${m.id}:${b.id}`, memberId: m.id, at: b.at, badge: b.id })
  }
  for (const c of Object.values(d.cheers)) {
    if (c.kind === 'kudos') continue
    if (opts.memberId && c.fromId !== opts.memberId && c.toId !== opts.memberId) continue
    items.push({ kind: c.kind, id: `cheer:${c.id}`, memberId: c.fromId, toId: c.toId, at: c.createdAt, emoji: c.emoji, text: c.text, cheerId: c.id })
  }
  for (const p of Object.values(d.mealPlans)) {
    if (opts.memberId && p.memberId !== opts.memberId) continue
    items.push({ kind: 'plan', id: `plan:${p.id}`, memberId: p.memberId, at: p.createdAt, planId: p.id, title: p.title, byId: p.createdBy })
  }
  for (const p of Object.values(d.posts)) {
    if (opts.memberId && p.memberId !== opts.memberId) continue
    items.push({ kind: 'post', id: `post:${p.id}`, memberId: p.memberId, at: p.createdAt, postId: p.id, text: p.text, photos: p.photos, editedAt: p.editedAt })
  }
  // id breaks ties so the order is stable when two things land on the same millisecond
  const out = items.filter((i) => !opts.since || i.at >= opts.since).sort((a, b) => b.at - a.at || a.id.localeCompare(b.id))
  return opts.limit ? out.slice(0, opts.limit) : out
}

/** Kudos on a feed item grouped by emoji: { "🔥": ["memberId", ...] } (insertion ordered by time). */
export function reactionsFor(cheers: Record<string, Cheer>, itemId: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const c of Object.values(cheers).filter((x) => x.kind === 'kudos' && x.ref === itemId).sort((a, b) => a.createdAt - b.createdAt)) {
    ;(out[c.emoji] ||= []).push(c.fromId)
  }
  return out
}

/** Nudges/messages addressed to a member they haven't seen yet, newest first. */
export function unseenCheers(cheers: Record<string, Cheer>, memberId: string): Cheer[] {
  return Object.values(cheers)
    .filter((c) => c.toId === memberId && !c.seenAt && c.kind !== 'kudos')
    .sort((a, b) => b.createdAt - a.createdAt)
}
