/**
 * Domain model shared by every feature and both backends (demo/local and Supabase).
 *
 * Conventions
 * - Every row has a string `id` and an `updatedAt` (ms since epoch, set by the client that wrote it).
 *   Sync is last-writer-wins on `updatedAt`.
 * - Dates without time are ISO calendar dates `YYYY-MM-DD` in the member's local time zone.
 * - Body weight is stored canonically in kilograms (`kg`). Set weights inside a workout log are stored
 *   as typed, in the log's `unit` (see `WorkoutLog.unit`), and converted when aggregated.
 */

export type Unit = 'kg' | 'lb'
export type Role = 'coach' | 'athlete'

/** Member identity colors. The first three are validated as a colorblind-safe set; keep this order. */
export type MemberColor = 'blue' | 'orange' | 'aqua' | 'yellow' | 'magenta' | 'green' | 'violet' | 'red'
export const MEMBER_COLORS: MemberColor[] = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red']

export type WeightVisibility = 'exact' | 'change' | 'private'

export interface MemberSettings {
  unit: Unit
  /** Newest squad post this member has seen (drives the unread count). Null until they open the chat. */
  lastSeenPostAt?: number | null
  /** Remembered machine / brand per exercise name, e.g. { "Leg Press": "Hammer Strength" }. */
  machines: Record<string, string>
  /** How the member's body weight appears to the rest of the squad. */
  weightVisibility: WeightVisibility
}

export interface Member {
  id: string
  /** Stable, url-safe handle ("stelios"). Also used to derive the login e-mail. */
  slug: string
  name: string
  role: Role
  color: MemberColor
  /** Included in leaderboards and head-to-head comparisons. */
  competes: boolean
  /** Free-text goal, e.g. "Lean bulk: +3 kg, bench 100 kg". */
  goal: string
  goalWeightKg: number | null
  heightCm: number | null
  programId: string | null
  /** First day of week 1 of the assigned program (YYYY-MM-DD). null = not started yet. */
  programStart: string | null
  /** A note from the coach shown on the member's home screen. Only the coach may change it. */
  settings: MemberSettings
  /** True once the member has claimed their login (Supabase: members.user_id is set). Read-only. */
  joined: boolean
  updatedAt: number
}

/** Program data uses the compact keys of the original BTS logbook so its JSON can be imported as-is. */
export interface ProgramExercise {
  /** Exercise name */
  n: string
  /** Last-set intensity technique, "N/A" when none (e.g. "Failure", "Myo-reps"). */
  t: string
  /** Warm-up sets, e.g. "2-3" */
  w: string
  /** Working sets, e.g. "2" */
  s: string
  /** Rep range, e.g. "8-10" */
  r: string
  /** Early-set RPE, e.g. "~8-9" */
  e: string
  /** Last-set RPE, e.g. "10" */
  l: string
  /** Rest, e.g. "2-3 min" */
  rest: string
  /** Substitution option 1 / 2 */
  s1?: string
  s2?: string
  /** Coaching note */
  note?: string
  /** Demo video for the main exercise / substitution 1 / substitution 2 */
  v?: string
  v1?: string
  v2?: string
}

export interface ProgramDay {
  /** e.g. "Upper (Strength Focus)": the short name is the part before " (". */
  name: string
  ex: ProgramExercise[]
}

export interface ProgramWeek {
  block: string
  /** Intro week: lighter effort, no sets to failure. */
  intro: boolean
  days: ProgramDay[]
}

export interface Program {
  id: string
  name: string
  description: string
  /** weeks[0] is week 1 */
  weeks: ProgramWeek[]
  /**
   * 7-slot weekly pattern relative to the program start date. Each slot is the index of the workout day
   * trained on that calendar day, or null for rest. BTS: Upper, Lower, rest, Pull, Push, Legs, rest => [0,1,null,2,3,4,null]
   */
  schedule: (number | null)[]
  /** Built-in programs ship with the app and are not stored in the database. */
  builtIn: boolean
  createdBy: string | null
  updatedAt: number
}

export interface SetLog {
  /** Weight as typed, in the log's unit ("" when empty). */
  w: string
  /** Reps as typed ("" when empty). */
  r: string
  /** Ticked as done. */
  ok: boolean
  /** When it was ticked (ms). */
  at?: number | null
}

export interface ExerciseLog {
  /** Which variant was performed: 0 = main exercise, 1 = substitution 1, 2 = substitution 2. */
  v: 0 | 1 | 2
  /** Machine / brand used ("" when not set). */
  m: string
  sets: SetLog[]
}

export interface WorkoutLog {
  /** `${memberId}__${programId}__w${week}d${day}` (see ids.ts) */
  id: string
  memberId: string
  programId: string
  /** 1-based program week */
  week: number
  /** 0-based index into ProgramWeek.days */
  day: number
  unit: Unit
  /** Keyed by exercise index within the day, as a string ("0", "1", ...). */
  ex: Record<string, ExerciseLog>
  done: boolean
  doneAt: number | null
  startedAt: number | null
  /** How the session felt, 1 (awful) .. 5 (great). */
  feel: number | null
  note: string
  updatedAt: number
}

export interface WeightEntry {
  /** `${memberId}__${date}`: one entry per member per day. */
  id: string
  memberId: string
  date: string
  kg: number
  bodyFat: number | null
  waistCm: number | null
  note: string
  updatedAt: number
}

export interface FileRef {
  /** Storage path (Supabase storage key, or IndexedDB key in demo mode). */
  path: string
  /** Which bucket it lives in. Absent means the meal-plan bucket, where every file lived before chat. */
  bucket?: string
  name: string
  type: string
  size: number
}

/** One food in a meal, with the macros of the portion (not per 100 g). */
export interface MealFood {
  id: string
  /** Display name as the coach entered or picked it. */
  name: string
  /** Portion in grams (null for a custom food entered without a weight). */
  grams: number | null
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  /** Id in the built-in food database (src/features/fuel/foods), when picked from it. */
  ref?: string | null
  /** Pieces, for foods counted by the piece (2 eggs, 1 pita); grams stays the source of truth. */
  pieces?: number | null
}

export interface Meal {
  id: string
  name: string
  /** "08:00" or "" */
  time: string
  /**
   * Free text. Plans made before food lists: one food per line. With `foods`: extra notes for the meal
   * ("horta with lemon, as much as you like").
   */
  items: string
  /**
   * The meal's foods with their macros. When present and not empty they are the source of truth, and the meal's
   * kcal/protein/carbs/fat below are their sums (kept in sync on save, so older readers still see totals).
   */
  foods?: MealFood[]
  kcal: number | null
  protein: number | null
  carbs?: number | null
  fat?: number | null
}

export interface MealPlan {
  id: string
  memberId: string
  title: string
  /** Free text; lines starting with "# " are headings and "- " are bullets. */
  notes: string
  startDate: string
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  meals: Meal[]
  files: FileRef[]
  /** The plan currently in force for the member (at most one active plan per member). */
  active: boolean
  createdBy: string
  createdAt: number
  updatedAt: number
}

export type CheckinRating = 'on' | 'mostly' | 'off'

export interface NutritionCheckin {
  /** `${memberId}__${date}` */
  id: string
  memberId: string
  date: string
  planId: string | null
  /** Ids of the plan's meals that were eaten as planned. */
  meals: string[]
  rating: CheckinRating | null
  note: string
  updatedAt: number
}

/**
 * A message in the squad chat. Activity (workouts, weigh-ins, PRs) is NOT stored here: it stays derived by
 * buildFeed and is merged with these at render time, so there is exactly one source of truth for each.
 */
export interface Post {
  id: string
  memberId: string
  /** May be empty when the post is only photos. */
  text: string
  photos: FileRef[]
  createdAt: number
  editedAt: number | null
  updatedAt: number
}

export type CheerKind = 'kudos' | 'nudge' | 'message'

export interface Cheer {
  id: string
  fromId: string
  toId: string
  kind: CheerKind
  /** What it refers to, e.g. a workout log id, "pr:<logId>:<exercise>", or null for a plain nudge. */
  ref: string | null
  emoji: string
  text: string
  createdAt: number
  seenAt: number | null
  updatedAt: number
}

export interface Snapshot {
  members: Member[]
  programs: Program[]
  logs: WorkoutLog[]
  weights: WeightEntry[]
  mealPlans: MealPlan[]
  checkins: NutritionCheckin[]
  cheers: Cheer[]
  posts: Post[]
}

export interface Tables {
  members: Member
  programs: Program
  logs: WorkoutLog
  weights: WeightEntry
  mealPlans: MealPlan
  checkins: NutritionCheckin
  cheers: Cheer
  posts: Post
}
export type TableName = keyof Tables
export const TABLES: TableName[] = ['members', 'programs', 'logs', 'weights', 'mealPlans', 'checkins', 'cheers', 'posts']

/** What the login screen may know about a member before anyone is signed in. */
export interface LoginProfile {
  id: string
  slug: string
  name: string
  color: MemberColor
  role: Role
  joined: boolean
}

export type ChangeEvent =
  | { [T in TableName]: { table: T; type: 'put'; row: Tables[T] } }[TableName]
  | { table: TableName; type: 'remove'; id: string }
