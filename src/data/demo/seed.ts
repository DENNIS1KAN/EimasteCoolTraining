/**
 * Deterministic demo data: a coach (Dennis) and two athletes (Stelios, Thanos) in week 3 of the BTS program.
 * The coach trains the program too and competes, lighter: a busy coach who misses a session most weeks.
 *
 * Everything is placed relative to `today`, and every random choice comes from a PRNG keyed by *relative*
 * position (program week/day, days since program start), so the same weekday always tells the same story:
 * - Stelios (blue): early bird on a cut, never misses a session, logs his food, fewer PRs.
 * - Thanos (orange): night owl on a lean bulk, missed Pull + Push in week 2, stronger legs, more volume and PRs.
 * - Dennis (aqua): lunchtime sessions, three missed so far, weighs in a few times a week to stay at maintenance.
 * Nothing is dated after `now` (default: the end of `today`).
 */
import type { Cheer, CheckinRating, ExerciseLog, Meal, MealFood, MealPlan, Member, NutritionCheckin, SetLog, Snapshot, WeightEntry, WorkoutLog } from '../types'
import type { ISODate } from '../../lib/dates'
import { addDays, dateRange, diffDays, isoFromMs, startOfWeek } from '../../lib/dates'
import { dailyId, logId } from '../../lib/ids'
import { personalRecords } from '../../lib/stats/lifts'
import { refKey, workoutOn } from '../../lib/stats/schedule'
import { BTS_PROGRAM, exerciseName, restSeconds, warmupSetCount, workingSets } from '../programs'
import { foodById, macrosFor } from '../../features/fuel/foods'
import { withDerivedTotals } from '../../features/fuel/lib/macros'

export const DEMO_IDS = { dennis: 'demo-dennis', stelios: 'demo-stelios', thanos: 'demo-thanos' } as const

/* ------------------------------------------------------------------ randomness and time */

const SEED = 0x2ec7_0012

interface Rng {
  next(): number
  /** Integer in [min, max]. */
  int(min: number, max: number): number
  range(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(xs: readonly T[]): T
}

/** FNV-1a, so every key gets its own independent stream. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rng(key: string): Rng {
  const next = mulberry32(hash(key) ^ SEED)
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (xs) => xs[Math.floor(next() * xs.length)],
  }
}

/** Index drawn with the given relative odds. */
function weighted(r: Rng, odds: readonly number[]): number {
  let x = r.next() * odds.reduce((a, b) => a + b, 0)
  for (let i = 0; i < odds.length; i++) {
    x -= odds[i]
    if (x < 0) return i
  }
  return odds.length - 1
}

/** A uuid-v4-shaped id that is stable for a key (demo rows must be identical for the same `today`). */
function uuidFor(key: string): string {
  const r = rng(`uuid:${key}`)
  const h = Array.from({ length: 32 }, () => r.int(0, 15))
  h[12] = 4
  h[16] = (h[16] & 0x3) | 0x8
  const s = h.map((x) => x.toString(16)).join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`
}

const SEC = 1000
const MIN = 60 * SEC

/** Local time on a calendar day, `minutes` after midnight. */
function at(date: ISODate, minutes: number): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, Math.round(minutes * 60)).getTime()
}
const hm = (h: number, m = 0) => h * 60 + m
const round1 = (x: number) => Math.round(x * 10) / 10
/** Day of week for a program day offset (the program starts on a Monday): 0 = Monday .. 6 = Sunday. */
const dowOf = (off: number) => ((off % 7) + 7) % 7
/** Alternating weeks (A/B) give weekly habits a little variety while any 14 days hold one of each. */
const parityOf = (off: number) => ((Math.floor(off / 7) % 2) + 2) % 2

/* ------------------------------------------------------------------ members */

function member(p: Partial<Member> & Pick<Member, 'id' | 'slug' | 'name' | 'role' | 'color'>): Member {
  return {
    competes: true,
    goal: '',
    goalWeightKg: null,
    heightCm: null,
    programId: BTS_PROGRAM.id,
    programStart: null,
    settings: { unit: 'kg', machines: {}, weightVisibility: 'exact' },
    joined: true,
    updatedAt: 1,
    ...p,
  }
}

function members(start: ISODate): Member[] {
  // when the coach last touched the athletes' profiles
  const profileAt = at(addDays(start, 13), hm(18, 20))
  return [
    member({
      id: DEMO_IDS.dennis,
      slug: 'dennis',
      name: 'Dennis',
      role: 'coach',
      color: 'aqua',
      heightCm: 180,
      goal: 'Get these two to week 12 in one piece (and keep up with them)',
      programStart: start,
      settings: { unit: 'kg', machines: DENNIS.machines, weightVisibility: 'exact' },
      updatedAt: at(addDays(start, -10), hm(21)),
    }),
    member({
      id: DEMO_IDS.stelios,
      slug: 'stelios',
      name: 'Stelios',
      role: 'athlete',
      color: 'blue',
      goal: 'Cut to 79 kg and bench 100 kg',
      goalWeightKg: 79,
      heightCm: 183,
      programStart: start,
      settings: { unit: 'kg', machines: STELIOS.machines, weightVisibility: 'exact' },
      updatedAt: profileAt,
    }),
    member({
      id: DEMO_IDS.thanos,
      slug: 'thanos',
      name: 'Thanos',
      role: 'athlete',
      color: 'orange',
      goal: 'Lean bulk to 75 kg and leg press 220 kg for 10',
      goalWeightKg: 75,
      heightCm: 176,
      programStart: start,
      settings: { unit: 'kg', machines: THANOS.machines, weightVisibility: 'exact' },
      updatedAt: profileAt + 4 * MIN,
    }),
  ]
}

/* ------------------------------------------------------------------ lifters */

/** One-off changes to a specific session (key: "w2d0"). */
interface Special {
  /** Exercise index -> substitution performed that day. */
  subs?: Record<number, 1 | 2>
  /** Exercise indexes with one set more than prescribed. */
  extra?: number[]
  note?: string
  feel?: number
}

interface Lifter {
  key: 'stelios' | 'thanos' | 'dennis'
  id: string
  /** Weight (kg) for a hard set of ~9 reps, per performed exercise. 0 = bodyweight (weight left empty). */
  base: Record<string, number>
  /** Exercises always done as a substitution (by main exercise name). */
  subs: Record<string, 1 | 2>
  machines: Record<string, string>
  /** Relative odds for a top set next session: [+2.5 kg, +1 rep, same, -1 rep]. */
  odds: readonly [number, number, number, number]
  /** Main lifts started one plate step lighter in the intro week. */
  ease: string[]
  /** Exercises that always get one set more than prescribed. */
  extraSets: string[]
  /** Session start in minutes after midnight for a weekday (0 = Monday). */
  startMin: (dow: number, r: Rng) => number
  /** Multiplier on prescribed rest (chatting between sets counts). */
  restFactor: number
  /** Feel (1-5) picked at random for sessions without a special. */
  feel: readonly number[]
  specials: Record<string, Special>
}

const STELIOS: Lifter = {
  key: 'stelios',
  id: DEMO_IDS.stelios,
  base: {
    '45° Incline Barbell Press': 57.5,
    'Cable Crossover Ladder': 15,
    'Wide-Grip Lat Pulldown': 62.5,
    'High-Cable Lateral Raise': 7.5,
    'Pendlay Deficit Row': 62.5,
    'Overhead Cable Triceps Extension (Bar)': 27.5,
    'Bayesian Cable Curl': 12.5,
    'Lying Leg Curl': 45,
    'Smith Machine Squat': 80,
    'Barbell RDL': 90,
    'Leg Extension': 60,
    'Standing Calf Raise': 80,
    'Cable Crunch': 45,
    'Neutral-Grip Lat Pulldown': 67.5,
    'Chest-Supported Machine Row': 60,
    'Chest-Supported T-Bar Row': 45,
    'Neutral-Grip Seated Cable Row': 62.5,
    '1-Arm 45° Cable Rear Delt Flye': 7.5,
    'Machine Shrug': 100,
    'EZ-Bar Cable Curl': 30,
    'Machine Preacher Curl': 27.5,
    'Barbell Bench Press': 70,
    'Machine Shoulder Press': 50,
    'Bottom-Half DB Flye': 15,
    'Cable Triceps Kickback': 10,
    'Roman Chair Leg Raise': 0,
    'Leg Press': 160,
    'Seated Leg Curl': 50,
    'DB Bulgarian Split Squat': 20,
    'Machine Hip Adduction': 60,
    'Machine Hip Abduction': 55,
  },
  subs: { 'Wide-Grip Pull-Up': 1 },
  machines: {
    'Leg Press': 'Hammer Strength',
    'Chest-Supported Machine Row': 'Hammer Strength',
    'Machine Shoulder Press': 'Technogym',
    'Wide-Grip Lat Pulldown': 'Life Fitness',
    'Leg Extension': 'Technogym',
  },
  odds: [1, 1.5, 4.5, 1.5],
  ease: ['Barbell Bench Press', 'Smith Machine Squat'],
  extraSets: [],
  startMin: (dow, r) => (dow === 5 ? hm(8, 40) + r.int(0, 15) : hm(6, 24) + r.int(0, 12)),
  restFactor: 1,
  feel: [3, 4, 4, 4, 5],
  specials: {
    w1d0: { note: 'Day 1 of BTS! Intro week, left 2-3 reps in the tank', feel: 4 },
    w1d2: { subs: { 1: 1 }, note: 'Row machine taken, T-bar instead' },
    w2d0: { note: 'Shoulder a bit tight on the incline, longer warm-up next time', feel: 3 },
    w2d3: { extra: [0], note: 'Felt strong 💪', feel: 5 },
    w3d1: { note: 'Slept 5 hours, still got it done', feel: 3 },
  },
}

const THANOS: Lifter = {
  key: 'thanos',
  id: DEMO_IDS.thanos,
  base: {
    '45° Incline Barbell Press': 50,
    'Cable Crossover Ladder': 12.5,
    'Wide-Grip Pull-Up': 5,
    'High-Cable Lateral Raise': 5,
    'Pendlay Deficit Row': 57.5,
    'Smith Machine Row': 60,
    'Overhead Cable Triceps Extension (Bar)': 25,
    'Bayesian Cable Curl': 10,
    'Lying Leg Curl': 52.5,
    'Smith Machine Squat': 100,
    'Barbell RDL': 110,
    'Leg Extension': 75,
    'Standing Calf Raise': 110,
    'Cable Crunch': 40,
    'Neutral-Grip Lat Pulldown': 60,
    'Chest-Supported Machine Row': 55,
    'Neutral-Grip Seated Cable Row': 57.5,
    '1-Arm 45° Cable Rear Delt Flye': 5,
    'Machine Shrug': 90,
    'EZ-Bar Cable Curl': 27.5,
    'Machine Preacher Curl': 22.5,
    'Barbell Bench Press': 62.5,
    'Machine Shoulder Press': 45,
    'Bottom-Half DB Flye': 12.5,
    'Cable Triceps Kickback': 7.5,
    'Roman Chair Leg Raise': 0,
    'Leg Press': 180,
    'Seated Leg Curl': 57.5,
    'DB Bulgarian Split Squat': 22.5,
    'Machine Hip Adduction': 75,
    'Machine Hip Abduction': 70,
  },
  subs: {},
  machines: {
    'Leg Press': 'Hammer Strength',
    'Smith Machine Squat': 'Life Fitness',
    'Lying Leg Curl': 'Technogym',
    'Machine Shrug': 'Panatta',
    'Machine Hip Adduction': 'Technogym',
  },
  odds: [1.5, 1.5, 3, 0.5],
  ease: ['45° Incline Barbell Press', 'Pendlay Deficit Row', 'Smith Machine Squat', 'Barbell RDL', 'Barbell Bench Press', 'Leg Press'],
  extraSets: ['Leg Press', 'Smith Machine Squat'],
  startMin: (dow, r) => (dow === 5 ? hm(12, 0) + r.int(0, 20) : hm(20, 30) + r.int(0, 30)),
  restFactor: 1.3,
  feel: [4, 4, 5, 5, 3],
  specials: {
    w1d1: { note: 'Squats felt great, could have done more', feel: 5 },
    w1d4: { note: 'Legs destroyed 🔥', feel: 5 },
    w2d0: { subs: { 4: 1 }, note: 'Gym packed, Smith rows instead of Pendlay', feel: 4 },
    w2d4: { extra: [3], note: 'Back after a crazy work week. Legs felt amazing', feel: 5 },
  },
}

/** The coach: a solid lifter who trains at lunch, progresses slowly and misses a session most weeks. */
const DENNIS: Lifter = {
  key: 'dennis',
  id: DEMO_IDS.dennis,
  base: {
    '45° Incline Barbell Press': 60,
    'Cable Crossover Ladder': 15,
    'Wide-Grip Pull-Up': 0,
    'High-Cable Lateral Raise': 7.5,
    'Pendlay Deficit Row': 65,
    'Overhead Cable Triceps Extension (Bar)': 30,
    'Bayesian Cable Curl': 12.5,
    'Lying Leg Curl': 47.5,
    'Smith Machine Squat': 90,
    'Barbell RDL': 100,
    'Leg Extension': 65,
    'Standing Calf Raise': 90,
    'Cable Crunch': 50,
    'Neutral-Grip Lat Pulldown': 70,
    'Chest-Supported Machine Row': 62.5,
    'Neutral-Grip Seated Cable Row': 65,
    '1-Arm 45° Cable Rear Delt Flye': 7.5,
    'Machine Shrug': 110,
    'EZ-Bar Cable Curl': 32.5,
    'Machine Preacher Curl': 27.5,
    'Barbell Bench Press': 75,
    'Machine Shoulder Press': 52.5,
    'Bottom-Half DB Flye': 15,
    'Cable Triceps Kickback': 10,
    'Roman Chair Leg Raise': 0,
    'Leg Press': 170,
    'Seated Leg Curl': 52.5,
    'DB Bulgarian Split Squat': 20,
    'Machine Hip Adduction': 65,
    'Machine Hip Abduction': 60,
  },
  subs: {},
  machines: { 'Leg Press': 'Hammer Strength', 'Machine Shoulder Press': 'Technogym' },
  odds: [0.8, 1.2, 5, 1.5],
  ease: [],
  extraSets: [],
  startMin: (dow, r) => (dow === 5 ? hm(10, 30) + r.int(0, 20) : hm(13, 5) + r.int(0, 20)),
  restFactor: 1.1,
  feel: [3, 4, 4, 4],
  specials: {
    w1d0: { note: 'Training with the boys this time. Let’s see who blinks first', feel: 4 },
    w2d1: { note: 'Lunch break session, 45 minutes flat', feel: 3 },
  },
}

/** Weeks 1 Pull, 2 Push and Legs: coaching got in the way. */
const DENNIS_MISSED = new Set(['w1d2', 'w2d3', 'w2d4'])

/** Weeks 2 Pull and Push: work trip. */
const THANOS_MISSED = new Set(['w2d2', 'w2d3'])

/* ------------------------------------------------------------------ workouts */

interface TopSet {
  kg: number
  reps: number
  /** Started a step light in the intro week: goes back up to the working weight next time. */
  eased?: boolean
}

function repRange(r: string): [number, number] {
  const nums = (r.match(/\d+/g) ?? ['8']).map(Number)
  return [nums[0], nums[1] ?? nums[0]]
}

const stepFor = (name: string) => (name === 'Leg Press' ? 5 : 2.5)
const roundTo = (x: number, step: number) => Math.max(step, Math.round(x / step) * step)
const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1))

/**
 * First session of an exercise slot: base weight scaled to the slot's rep range (~3.5% per rep, a bit steeper
 * than Epley, as people really go lighter for high-rep work); intro week eases in.
 */
function firstTop(name: string, base: number, lo: number, hi: number, intro: boolean, l: Lifter): TopSet {
  if (!base) return { kg: 0, reps: Math.min(hi, lo + (l.key === 'thanos' ? 6 : 4)) }
  const step = stepFor(name)
  const kg = roundTo(base * (1 - ((lo + hi) / 2 - 9) * 0.035), step)
  const eased = intro && l.ease.includes(name)
  return { kg: eased ? kg - step : kg, reps: Math.min(hi, lo + 1), eased }
}

/** Double progression with some bad days: add load, add a rep, repeat, or lose a rep. */
function nextTop(prev: TopSet, lo: number, hi: number, step: number, odds: Lifter['odds'], r: Rng): TopSet {
  // small isolation lifts stall more often (a 2.5 kg jump is a big one there)
  const o = weighted(r, prev.kg && prev.kg <= 15 ? [odds[0], odds[1], odds[2] * 2, odds[3]] : odds)
  if (prev.eased) return { kg: prev.kg + step, reps: o === 1 ? Math.min(hi, prev.reps + 1) : prev.reps }
  if (!prev.kg) return { kg: 0, reps: Math.min(hi, Math.max(lo, prev.reps + [2, 1, 0, -1][o])) }
  if (o === 0 && prev.kg > 15) return { kg: prev.kg + step, reps: prev.reps }
  if (o <= 1) return prev.reps < hi ? { kg: prev.kg, reps: prev.reps + 1 } : { kg: prev.kg + step, reps: Math.max(lo, prev.reps - 2) }
  if (o === 2) return prev
  return { kg: prev.kg, reps: Math.max(lo, prev.reps - 1) }
}

/** Odds for a session where everything goes up (Thanos's live one: PRs while you watch). */
const HOT: Lifter['odds'] = [1, 1, 0, 0]

/**
 * A finished session, with sets spaced by the prescribed rest. `tops` carries progression between sessions;
 * `hot` makes every lift go up.
 */
function session(l: Lifter, week: number, day: number, date: ISODate, off: number, tops: Map<string, TopSet>, hot = false): WorkoutLog {
  const r = rng(`${l.key}:w${week}d${day}`)
  const pw = BTS_PROGRAM.weeks[week - 1]
  const sp = l.specials[`w${week}d${day}`] ?? {}
  const startedAt = at(date, l.startMin(dowOf(off), r))
  let t = startedAt + r.int(4, 7) * MIN
  const ex: Record<string, ExerciseLog> = {}
  pw.days[day].ex.forEach((e, i) => {
    const v = sp.subs?.[i] ?? l.subs[e.n] ?? 0
    const name = exerciseName(e, v)
    const base = l.base[name] ?? 0
    const [lo, hi] = repRange(e.r)
    const step = stepFor(name)
    const slot = `${day}:${i}:${name}`
    const prev = tops.get(slot)
    const top = prev ? nextTop(prev, lo, hi, step, hot ? HOT : l.odds, r) : firstTop(name, base, lo, hi, pw.intro, l)
    tops.set(slot, top)
    t += (warmupSetCount(e) * 60 + r.int(60, 150)) * SEC
    const n = workingSets(e) + (sp.extra?.includes(i) || l.extraSets.includes(name) ? 1 : 0)
    const sets: SetLog[] = []
    let reps = top.reps
    for (let j = 0; j < n; j++) {
      if (j > 0) {
        t += (restSeconds(e.rest) + r.int(0, 45)) * l.restFactor * SEC
        const drop = j === n - 1 && !pw.intro ? r.int(1, 2) : r.int(0, 1)
        reps = Math.max(Math.max(1, lo - 2), reps - drop)
      }
      t += r.int(30, 55) * SEC
      sets.push({ w: base ? fmtKg(top.kg) : '', r: String(reps), ok: true, at: Math.round(t) })
    }
    ex[String(i)] = { v, m: l.machines[name] ?? '', sets }
  })
  const doneAt = Math.round(t + r.int(3, 7) * MIN)
  return {
    id: logId(l.id, BTS_PROGRAM.id, week, day),
    memberId: l.id,
    programId: BTS_PROGRAM.id,
    week,
    day,
    unit: 'kg',
    ex,
    done: true,
    doneAt,
    startedAt,
    feel: sp.feel ?? null,
    note: sp.note ?? '',
    updatedAt: doneAt,
  }
}

/** Cut a finished session back to "mid-workout": first `exercises` done, one set into the next one. */
function inProgress(log: WorkoutLog, exercises = 2): WorkoutLog {
  const ex: Record<string, ExerciseLog> = {}
  let last = log.startedAt ?? log.updatedAt
  for (const [k, e] of Object.entries(log.ex)) {
    const i = Number(k)
    if (i > exercises) continue
    const sets = i < exercises ? e.sets : e.sets.map((s, j) => (j === 0 ? s : { w: s.w, r: '', ok: false, at: null }))
    for (const s of sets) if (s.ok && s.at) last = Math.max(last, s.at)
    ex[k] = { ...e, sets }
  }
  return { ...log, ex, done: false, doneAt: null, feel: null, note: '', updatedAt: last }
}

function shiftLog(log: WorkoutLog, delta: number): WorkoutLog {
  const sh = (x: number | null | undefined) => (x == null ? x : x + delta)
  const ex = Object.fromEntries(Object.entries(log.ex).map(([k, e]) => [k, { ...e, sets: e.sets.map((s) => ({ ...s, at: sh(s.at) })) }]))
  return { ...log, ex, startedAt: sh(log.startedAt) ?? null, doneAt: sh(log.doneAt) ?? null, updatedAt: log.updatedAt + delta }
}

/**
 * Every scheduled workout before today (minus `missed`), plus today's: finished (Stelios, early morning)
 * or in progress (Thanos). A live session is moved earlier when `clock` hasn't reached it yet.
 */
function workouts(l: Lifter, start: ISODate, today: ISODate, clock: number, missed: Set<string>, todayLive: boolean): WorkoutLog[] {
  const tops = new Map<string, TopSet>()
  const out: WorkoutLog[] = []
  for (const date of dateRange(start, today)) {
    const ref = workoutOn(BTS_PROGRAM, start, date)
    if (!ref || missed.has(refKey(ref))) continue
    const log = session(l, ref.week, ref.day, date, diffDays(start, date), tops, todayLive && date === today)
    if (date < today) out.push(log)
    else if (!todayLive) {
      if ((log.doneAt ?? 0) <= clock) out.push(log)
    } else {
      let live = inProgress(log)
      const latest = clock - 2 * MIN
      if (live.updatedAt > latest) live = shiftLog(live, latest - live.updatedAt)
      if ((live.startedAt ?? 0) >= at(today, hm(6))) out.push(live)
    }
  }
  const prs = prCounts(out)
  const r = rng(`${l.key}:feel`)
  for (const log of out) if (log.done && log.feel == null) log.feel = (prs.get(log.id) ?? 0) >= 3 ? 5 : r.pick(l.feel)
  return out
}

/** PRs set in each log, per member. */
function prCounts(logs: WorkoutLog[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const id of new Set(logs.map((l) => l.memberId))) {
    const mine = logs.filter((l) => l.memberId === id)
    for (const p of personalRecords(mine, { [BTS_PROGRAM.id]: BTS_PROGRAM })) out.set(p.logId, (out.get(p.logId) ?? 0) + 1)
  }
  return out
}

/* ------------------------------------------------------------------ body weight */

function weighIn(memberId: string, date: ISODate, kg: number, updatedAt: number, extra: Partial<WeightEntry> = {}): WeightEntry {
  return { id: dailyId(memberId, date), memberId, date, kg: round1(kg), bodyFat: null, waistCm: null, note: '', updatedAt, ...extra }
}

/** Near-daily, from a week before the program; cutting ~0.5 kg a week after a small water drop. */
function steliosWeights(start: ISODate, today: ISODate): WeightEntry[] {
  const out: WeightEntry[] = []
  for (const date of dateRange(addDays(start, -7), today)) {
    const off = diffDays(start, date)
    const dow = dowOf(off)
    // sleeps in on alternate Sundays; skips a rest-day Wednesday on the other weeks
    if (off !== 0 && (parityOf(off) === 0 ? dow === 6 : dow === 2)) continue
    const r = rng(`stelios:weight:${off}`)
    const trend = off < 0 ? 84.2 - off * 0.1 : 84.2 - 0.35 * (1 - Math.exp(-off / 4)) - (off * 0.5) / 7
    const kg = off === 0 ? 84.2 : trend + r.range(-0.4, 0.4) + (dow === 0 ? 0.2 : 0)
    const monday = dow === 0
    out.push(
      weighIn(DEMO_IDS.stelios, date, kg, at(date, hm(6, 4) + r.int(0, 14)), {
        bodyFat: monday ? round1(19.4 - (84.2 - trend) * 0.45 + r.range(-0.2, 0.2)) : null,
        waistCm: monday ? round1(92 - (84.2 - trend) * 0.8) : null,
        note: off === 0 ? 'Program day 1' : off === 7 ? 'Salty souvlaki night 🙈' : '',
      }),
    )
  }
  return out
}

/** Three or four times a week; lean bulk ~0.25 kg a week plus the first-weeks glycogen bump. */
function thanosWeights(start: ISODate, today: ISODate): WeightEntry[] {
  const out: WeightEntry[] = []
  for (const date of dateRange(addDays(start, -7), today)) {
    const off = diffDays(start, date)
    const days = parityOf(off) === 0 ? [0, 2, 4, 5] : [0, 3, 6]
    if (off !== 0 && !days.includes(dowOf(off))) continue
    const r = rng(`thanos:weight:${off}`)
    const trend = off < 0 ? 71.5 + off * 0.02 : 71.5 + 0.6 * (1 - Math.exp(-off / 5)) + (off * 0.25) / 7
    const kg = off === 0 ? 71.5 : trend + r.range(-0.3, 0.3)
    const note = off === 0 ? 'Bulk starts today 🍝' : off === 14 ? "After yiayia's Sunday lunch 😅" : ''
    out.push(weighIn(DEMO_IDS.thanos, date, kg, at(date, hm(9, 5) + r.int(0, 35)), { note }))
  }
  return out
}

/** Two or three mornings a week, holding steady around 88 kg (maintenance). */
function dennisWeights(start: ISODate, today: ISODate): WeightEntry[] {
  const out: WeightEntry[] = []
  for (const date of dateRange(addDays(start, -7), today)) {
    const off = diffDays(start, date)
    const days = parityOf(off) === 0 ? [0, 3] : [0, 2, 4]
    if (off !== 0 && !days.includes(dowOf(off))) continue
    const r = rng(`dennis:weight:${off}`)
    const kg = off === 0 ? 88.4 : 88.4 - (off * 0.1) / 7 + r.range(-0.35, 0.35)
    out.push(weighIn(DEMO_IDS.dennis, date, kg, at(date, hm(7, 15) + r.int(0, 20)), { note: off === 0 ? 'Coach joins the program too' : '' }))
  }
  return out
}

/* ------------------------------------------------------------------ nutrition */

/** A food from the built-in database: [food id, grams] or [food id, grams, pieces]. */
type FoodSpec = [ref: string, grams: number, pieces?: number]

interface MealSpec {
  name: string
  time: string
  foods: FoodSpec[]
  /** Extra notes for the meal. */
  notes?: string
}

function mealFood(key: string, [ref, grams, pieces]: FoodSpec): MealFood {
  const food = foodById(ref)
  if (!food) throw new Error(`Demo seed: unknown food ${ref}`)
  const out: MealFood = { id: uuidFor(key), name: food.en, grams, ...macrosFor(food, grams), ref }
  if (pieces != null) out.pieces = pieces
  return out
}

function plan(
  key: string,
  memberId: string,
  p: Pick<MealPlan, 'title' | 'notes' | 'startDate' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'active' | 'createdAt' | 'updatedAt'>,
  meals: MealSpec[],
  createdBy: string = DEMO_IDS.dennis,
): MealPlan {
  const ms: Meal[] = meals.map((m, i) =>
    withDerivedTotals({
      id: uuidFor(`${key}:meal:${i}`),
      name: m.name,
      time: m.time,
      items: m.notes ?? '',
      foods: m.foods.map((f, k) => mealFood(`${key}:meal:${i}:food:${k}`, f)),
      kcal: null,
      protein: null,
    }),
  )
  return { id: uuidFor(key), memberId, meals: ms, files: [], createdBy, ...p }
}

function mealPlans(start: ISODate): MealPlan[] {
  const v2At = at(addDays(start, -8), hm(18, 30))
  const bulkAt = at(addDays(start, -8), hm(19, 10))
  const dennisAt = at(addDays(start, -8), hm(21, 5))
  return [
    plan(
      'plan:stelios:v1',
      DEMO_IDS.stelios,
      {
        title: 'Cut phase · v1',
        notes: ['# Targets', '- 2,600 kcal · 170 g protein', '- Weigh in 3 times a week', '# Rules', '- No liquid calories', '- Olive oil: measure it'].join('\n'),
        startDate: addDays(start, -21),
        kcal: 2600,
        protein: 170,
        carbs: 280,
        fat: 75,
        active: false,
        createdAt: at(addDays(start, -22), hm(20, 15)),
        updatedAt: v2At,
      },
      [
        { name: 'Breakfast', time: '08:00', foods: [['greek-yogurt-2', 250], ['oats', 80], ['honey', 21], ['banana', 118, 1]] },
        {
          name: 'Lunch',
          time: '14:30',
          foods: [['chicken-breast-cooked', 170], ['rice-white-cooked', 250], ['tomato', 120, 1], ['cucumber', 100], ['feta', 40], ['olive-oil', 15]],
        },
        { name: 'Snack', time: '18:00', foods: [['whey', 30, 1], ['banana', 118, 1], ['almonds', 20]] },
        { name: 'Dinner', time: '21:00', foods: [['salmon-cooked', 150], ['potato-boiled', 300], ['horta', 200], ['olive-oil', 5]], notes: 'Horta with lemon' },
      ],
    ),
    plan(
      'plan:stelios:v2',
      DEMO_IDS.stelios,
      {
        title: 'Cut phase · v2',
        notes: [
          '# Targets',
          '- 2,400 kcal · 180 g protein, training and rest days alike',
          '- 3 L water, more on hot days',
          '- Weigh in every morning, after the bathroom, before food',
          '# Rules',
          '- Olive oil: measure it (1 tbsp = 120 kcal)',
          '- Swap rice for potato or bread by the scale, not by eye',
          '- One free meal a week (Saturday dinner): one plate, no second round',
          '# What changed in v2',
          '- Carbs 280 → 250 g, fat 75 → 70 g',
          '- New 11:00 snack so the gym morning is covered',
        ].join('\n'),
        startDate: addDays(start, -7),
        kcal: 2400,
        protein: 180,
        carbs: 250,
        fat: 70,
        active: true,
        createdAt: v2At,
        updatedAt: v2At,
      },
      [
        { name: 'Post-workout breakfast', time: '08:00', foods: [['greek-yogurt-2', 250], ['oats', 60], ['honey', 7, 1], ['blueberries', 100]] },
        { name: 'Snack', time: '11:00', foods: [['whey', 30, 1], ['apple', 180, 1], ['almonds', 15]], notes: 'Shake with water' },
        {
          name: 'Lunch',
          time: '14:30',
          foods: [['chicken-souvlaki', 180, 2], ['rice-white-cooked', 150], ['horta', 200], ['olive-oil', 5], ['tzatziki', 50]],
          notes: 'Horta with lemon',
        },
        { name: 'Afternoon snack', time: '18:00', foods: [['cottage-2', 100], ['rusk-barley', 30, 1], ['cherry-tomatoes', 150, 10], ['cucumber', 100]] },
        {
          name: 'Dinner',
          time: '21:00',
          foods: [['sea-bream', 150], ['potato-baked', 250], ['tomato', 120, 1], ['cucumber', 100], ['feta-light', 40], ['olive-oil', 10]],
          notes: 'Sea bream or salmon, whatever the fishmonger has',
        },
      ],
    ),
    plan(
      'plan:thanos:bulk',
      DEMO_IDS.thanos,
      {
        title: 'Lean bulk',
        notes: [
          '# Targets',
          '- 3,100 kcal · 160 g protein · 400 g carbs',
          '- +0.25 kg a week on the weekly average, not faster',
          '# Tips',
          "- Can't finish a meal? Drink it: milk, oats, banana and honey in the blender",
          '- Carbs around training: rice cakes and honey before, big dinner after',
          '- Weigh in at least 3 mornings a week',
        ].join('\n'),
        startDate: addDays(start, -7),
        kcal: 3100,
        protein: 160,
        carbs: 400,
        fat: 85,
        active: true,
        createdAt: bulkAt,
        updatedAt: bulkAt,
      },
      [
        { name: 'Breakfast', time: '09:00', foods: [['oats', 100], ['milk-semi', 300], ['banana', 118, 1], ['peanut-butter', 16, 1]], notes: 'Oats cooked in the milk' },
        { name: 'Snack', time: '12:00', foods: [['bread-wholegrain', 60, 2], ['turkey-slices', 80, 4], ['gouda', 20, 1], ['orange-juice', 250]] },
        {
          name: 'Lunch',
          time: '15:00',
          foods: [['chicken-breast-cooked', 100], ['orzo-cooked', 250], ['tomato-passata', 100], ['tomato', 120, 1], ['cucumber', 100], ['feta', 30]],
          notes: 'Chicken kritharaki with a Greek salad',
        },
        { name: 'Afternoon snack', time: '18:30', foods: [['greek-yogurt-2', 150], ['honey', 21, 3], ['walnuts', 10]] },
        { name: 'Pre-workout', time: '19:45', foods: [['banana', 118, 1], ['rice-cakes', 18, 2], ['honey', 14, 2]] },
        {
          name: 'Dinner',
          time: '22:30',
          foods: [['pork-souvlaki', 90, 1], ['pita-souvlaki', 70, 1], ['potatoes-oven-greek', 200], ['tzatziki', 50]],
          notes: 'Pork or chicken souvlaki, both fine',
        },
      ],
    ),
    plan(
      'plan:dennis:maintenance',
      DEMO_IDS.dennis,
      {
        title: 'Maintenance',
        notes: ['# Targets', '- 2,700 kcal · 170 g protein', '- Hold 88 kg while training with the squad', '# Rules', '- Lunch before the session, big dinner after'].join('\n'),
        startDate: addDays(start, -7),
        kcal: 2700,
        protein: 170,
        carbs: 300,
        fat: 85,
        active: true,
        createdAt: dennisAt,
        updatedAt: dennisAt,
      },
      [
        { name: 'Breakfast', time: '08:00', foods: [['egg', 100, 2], ['bread-village', 80, 2], ['feta', 30], ['tomato', 120, 1]] },
        { name: 'Lunch', time: '12:30', foods: [['chicken-breast-cooked', 150], ['rice-white-cooked', 400], ['broccoli', 150], ['olive-oil', 10]] },
        { name: 'Snack', time: '16:30', foods: [['greek-yogurt-2', 250], ['honey', 21, 3], ['walnuts', 10], ['apple', 180, 1]] },
        {
          name: 'Dinner',
          time: '20:30',
          foods: [['beef-steak-cooked', 180], ['potatoes-oven-greek', 250], ['bread-village', 40, 1], ['lettuce', 100], ['olive-oil', 5]],
          notes: 'Steak or bifteki, grilled',
        },
      ],
    ),
  ]
}

interface DayFood {
  /** Indexes of the meals eaten as planned, or null for a rating-only check-in. */
  eaten: number[] | null
  rating: CheckinRating
  note?: string
}

const all = (n: number) => Array.from({ length: n }, (_, i) => i)
const without = (n: number, ...skip: number[]) => all(n).filter((i) => !skip.includes(i))

/** ~85%: weekdays by the book bar a skipped snack, Sunday lunch at yiayia's, forgets to log once a fortnight. */
function steliosDay(off: number, r: Rng): DayFood | null {
  const dow = dowOf(off)
  const b = parityOf(off) === 1
  if (b && dow === 3) return null
  if (dow === 6) return b ? { eaten: without(5, 3), rating: 'mostly' } : { eaten: [0, 1, 4], rating: 'mostly', note: "Sunday lunch at yiayia's 😅" }
  if (dow === 5) return b ? { eaten: all(5), rating: 'on', note: 'Free meal: souvlaki with the guys' } : { eaten: without(5, 1), rating: 'on' }
  return r.chance(0.9) ? { eaten: all(5), rating: 'on' } : { eaten: without(5, r.pick([1, 3])), rating: 'on' }
}

/**
 * ~65%: a fixed fortnight (so any 14-day window scores the same) of good days, skipped snacks, rating-only days,
 * a name-day party and a day he forgot to log.
 */
const THANOS_FORTNIGHT: (DayFood | null)[] = [
  { eaten: all(6), rating: 'on' },
  { eaten: without(6, 1), rating: 'on' },
  { eaten: without(6, 1, 3), rating: 'mostly', note: 'No time for snacks at work' },
  null,
  { eaten: null, rating: 'mostly' },
  { eaten: without(6, 3), rating: 'on' },
  { eaten: null, rating: 'off', note: 'Name day party 🎉' },
  { eaten: all(6), rating: 'on' },
  { eaten: without(6, 1), rating: 'on' },
  { eaten: without(6, 4), rating: 'on' },
  { eaten: without(6, 3), rating: 'on' },
  { eaten: without(6, 1, 4), rating: 'mostly' },
  { eaten: all(6), rating: 'on', note: 'Finally hit every meal' },
  { eaten: null, rating: 'mostly' },
]

/** The coach logs when he remembers: training weekdays mostly, rarely on weekends. */
function dennisDay(off: number): DayFood | null {
  const dow = dowOf(off)
  if (dow === 0 || dow === 1 || dow === 3) return { eaten: all(4), rating: 'on' }
  if (dow === 4) return { eaten: without(4, 2), rating: 'mostly' }
  if (dow === 5) return { eaten: null, rating: 'mostly' }
  return null
}

/** Stelios's v2 meal index -> the same meal in v1 (v1 had no 11:00 snack). */
const V2_TO_V1: (number | null)[] = [0, null, 1, 2, 3]

/** Both athletes log from the day their first plan started (adherence counts from there). */
function checkins(plans: MealPlan[], start: ISODate, today: ISODate): NutritionCheckin[] {
  const out: NutritionCheckin[] = []
  const active = (memberId: string) => plans.find((p) => p.memberId === memberId && p.active)!
  const sPlan = active(DEMO_IDS.stelios)
  const sV1 = plans.find((p) => p.memberId === DEMO_IDS.stelios && !p.active)!
  const tPlan = active(DEMO_IDS.thanos)
  const dPlan = active(DEMO_IDS.dennis)
  const row = (p: MealPlan, date: ISODate, food: DayFood, updatedAt: number): NutritionCheckin => ({
    id: dailyId(p.memberId, date),
    memberId: p.memberId,
    date,
    planId: p.id,
    meals: (food.eaten ?? []).map((i) => p.meals[i].id),
    rating: food.rating,
    note: food.note ?? '',
    updatedAt,
  })
  const yesterday = addDays(today, -1)
  for (const date of dateRange(sV1.startDate, yesterday)) {
    const off = diffDays(start, date)
    const rs = rng(`stelios:food:${off}`)
    const s = steliosDay(off, rs)
    if (!s) continue
    const v1 = date < sPlan.startDate
    const food = v1 && s.eaten ? { ...s, eaten: s.eaten.flatMap((i) => V2_TO_V1[i] ?? []) } : s
    out.push(row(v1 ? sV1 : sPlan, date, food, at(date, hm(21, 40) + rs.int(0, 45))))
  }
  for (const date of dateRange(tPlan.startDate, yesterday)) {
    const off = diffDays(start, date)
    const rt = rng(`thanos:food:${off}`)
    const t = THANOS_FORTNIGHT[((off % 14) + 14) % 14]
    if (t) out.push(row(tPlan, date, t, at(date, hm(23, 5) + rt.int(0, 40))))
  }
  for (const date of dateRange(dPlan.startDate, yesterday)) {
    const off = diffDays(start, date)
    const rd = rng(`dennis:food:${off}`)
    const d = dennisDay(off)
    if (d) out.push(row(dPlan, date, d, at(date, hm(22, 10) + rd.int(0, 30))))
  }
  // today so far: Stelios ticks meals as he goes, Thanos logs at night
  out.push({ ...row(sPlan, today, { eaten: [0, 1], rating: 'on' }, at(today, hm(11, 20))), rating: null })
  return out
}

/* ------------------------------------------------------------------ cheers */

const KUDOS = ['🔥', '💪', '👏'] as const

/** When a reactor gets to see a finished workout: coach within a few hours, the rival on his own schedule. */
function reactionTime(from: string, doneAt: number, r: Rng): number {
  const date = isoFromMs(doneAt)
  const nextMorning = (minutes: number) => at(addDays(date, 1), minutes)
  if (from === DEMO_IDS.dennis) {
    const t = doneAt + r.int(20, 150) * MIN
    return t >= at(date, hm(23)) ? nextMorning(hm(7, 10) + r.int(0, 30)) : t
  }
  // Stelios is asleep by the time Thanos finishes; he catches up before his own session
  if (from === DEMO_IDS.stelios) return new Date(doneAt).getHours() >= 21 ? nextMorning(hm(6, 2) + r.int(0, 12)) : doneAt + r.int(30, 180) * MIN
  return doneAt + r.int(60, 300) * MIN
}

function cheer(key: string, c: Omit<Cheer, 'id' | 'updatedAt'>): Cheer {
  return { id: uuidFor(key), ...c, updatedAt: c.seenAt ?? c.createdAt }
}

function cheers(logs: WorkoutLog[], today: ISODate, start: ISODate): Cheer[] {
  const prCount = prCounts(logs)
  const seenBefore = at(addDays(today, -1), 0)
  const seen = (createdAt: number, r: Rng) => (createdAt < seenBefore ? createdAt + r.int(15, 240) * MIN : null)
  const out: Cheer[] = []
  for (const l of logs) {
    if (!l.done || l.doneAt == null) continue
    const prs = prCount.get(l.id) ?? 0
    // the coach cheers his athletes; the athletes cheer each other, and the coach now and then
    const reactors: [string, number][] =
      l.memberId === DEMO_IDS.dennis
        ? [
            [DEMO_IDS.stelios, prs >= 2 ? 0.7 : 0.4],
            [DEMO_IDS.thanos, prs >= 2 ? 0.6 : 0.3],
          ]
        : [
            [DEMO_IDS.dennis, prs >= 3 ? 1 : 0.6],
            [l.memberId === DEMO_IDS.stelios ? DEMO_IDS.thanos : DEMO_IDS.stelios, prs >= 2 ? 0.85 : 0.5],
          ]
    for (const [from, p] of reactors) {
      const r = rng(`kudos:${from}:${l.id}`)
      if (!r.chance(p)) continue
      const createdAt = reactionTime(from, l.doneAt, r)
      const emoji = prs >= 3 && from === DEMO_IDS.dennis ? '🏆' : r.pick(KUDOS)
      out.push(cheer(`kudos:${from}:${l.id}`, { fromId: from, toId: l.memberId, kind: 'kudos', ref: `workout:${l.id}`, emoji, text: '', createdAt, seenAt: seen(createdAt, r) }))
    }
  }
  const { stelios, thanos, dennis } = DEMO_IDS
  const missedPull = addDays(start, 10)
  const sunday = addDays(start, 13)
  out.push(
    cheer('nudge:1', {
      fromId: stelios,
      toId: thanos,
      kind: 'nudge',
      ref: null,
      emoji: '😄',
      text: 'No Pull day? Your lats are filing a complaint',
      createdAt: at(missedPull, hm(21, 32)),
      seenAt: at(addDays(missedPull, 1), hm(8, 50)),
    }),
    cheer('message:1', {
      fromId: dennis,
      toId: thanos,
      kind: 'message',
      ref: null,
      emoji: '📋',
      text: "Missed Pull and Push this week, it happens. Don't double up to catch up: start week 3 fresh on Monday and hit every session. Proud of that leg day 💪",
      createdAt: at(sunday, hm(18, 35)),
      seenAt: at(sunday, hm(19, 2)),
    }),
    // the latest one: Thanos hasn't opened it yet
    cheer('nudge:3', {
      fromId: stelios,
      toId: thanos,
      kind: 'nudge',
      ref: null,
      emoji: '😄',
      text: "Still 2 sessions behind, champ. The bench won't press itself",
      createdAt: at(addDays(today, -1), hm(21, 40)),
      seenAt: null,
    }),
  )
  // Thanos brags with his real leg press numbers from week 2
  const legs = logs.find((l) => l.id === logId(thanos, BTS_PROGRAM.id, 2, 4))
  const press = legs?.ex['0']?.sets[0]
  if (legs?.doneAt && press) {
    out.push(
      cheer('nudge:2', {
        fromId: thanos,
        toId: stelios,
        kind: 'nudge',
        ref: null,
        emoji: '😏',
        text: `Leg press ${press.w} kg × ${press.r} 🦵 Your move, early bird`,
        createdAt: legs.doneAt + 25 * MIN,
        seenAt: at(sunday, hm(6, 5)),
      }),
    )
  }
  return out
}

/* ------------------------------------------------------------------ snapshot */

/**
 * Demo data relative to `today` (program started on the Monday two weeks before this week's Monday, so today is
 * in program week 3). `now` (ms) caps today's events; it defaults to the end of `today`. Pure: the same inputs
 * always give the same snapshot.
 */
export function createDemoSnapshot(today: ISODate, now?: number): Snapshot {
  const start = addDays(startOfWeek(today), -14)
  const clock = Math.min(now ?? Infinity, at(addDays(today, 1), 0) - 1)
  const logs = [
    ...workouts(STELIOS, start, today, clock, new Set(), false),
    ...workouts(THANOS, start, today, clock, THANOS_MISSED, true),
    ...workouts(DENNIS, start, today, clock, DENNIS_MISSED, false),
  ].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
  const plans = mealPlans(start)
  const past = <T extends { updatedAt: number }>(rows: T[]) => rows.filter((x) => x.updatedAt <= clock)
  return {
    members: members(start),
    programs: [],
    // the squad's own chat: nothing to invent, they write it themselves
    posts: [],
    logs,
    weights: past([...steliosWeights(start, today), ...thanosWeights(start, today), ...dennisWeights(start, today)]),
    mealPlans: plans,
    checkins: past(checkins(plans, start, today)),
    cheers: cheers(logs, today, start)
      .filter((c) => c.createdAt <= clock)
      .map((c) => (c.seenAt != null && c.seenAt > clock ? { ...c, seenAt: null, updatedAt: c.createdAt } : c))
      .sort((a, b) => a.createdAt - b.createdAt),
  }
}
