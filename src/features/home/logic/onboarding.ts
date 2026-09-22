import type { MealPlan, Member } from '../../../data/types'

/** Dismissal ids (src/lib/prefs.ts dismissHint) and the "plan checked" marker. */
export const HINT_ATHLETE = 'home-onboarding'
export const HINT_COACH = 'home-coach-setup'
export const HINT_PLAN_SEEN = 'home-plan-seen'
/** Set once a checklist was shown with something left to do, so finishing it later earns the "all set" card. */
export const SEEN_SUFFIX = ':seen'

export type AthleteStepId = 'start' | 'weigh' | 'plan'
export type CoachStepId = 'invite' | 'start' | 'plans'

export interface Step<Id extends string> {
  id: Id
  done: boolean
  /** Waiting on someone else (e.g. the coach hasn't assigned a program or uploaded a plan yet). */
  waiting: boolean
  /** For squad-wide steps: how many members are ready, out of `total`. */
  count?: number
  total?: number
}

export interface AthleteInput {
  hasProgram: boolean
  programStart: string | null
  weighIns: number
  hasPlan: boolean
  checkins: number
  /** The viewer opened their meal plan from the checklist. */
  planSeen: boolean
}

/** Set your start date -> log your first weigh-in -> check your meal plan. */
export function athleteSteps(i: AthleteInput): Step<AthleteStepId>[] {
  const planDone = i.checkins > 0 || (i.hasPlan && i.planSeen)
  return [
    { id: 'start', done: !!i.programStart, waiting: !i.programStart && !i.hasProgram },
    { id: 'weigh', done: i.weighIns > 0, waiting: false },
    { id: 'plan', done: planDone, waiting: !planDone && !i.hasPlan },
  ]
}

/** Invite the squad -> give everyone a start date -> upload meal plans. Counts athletes only. */
export function coachSteps(members: Member[], plans: MealPlan[]): Step<CoachStepId>[] {
  const athletes = members.filter((m) => m.role === 'athlete')
  const total = athletes.length
  const joined = athletes.filter((m) => m.joined).length
  const started = athletes.filter((m) => !!m.programId && !!m.programStart).length
  const withPlan = athletes.filter((m) => plans.some((p) => p.memberId === m.id && p.active)).length
  const all = (n: number) => total > 0 && n >= total
  return [
    { id: 'invite', done: all(joined), waiting: false, count: joined, total },
    { id: 'start', done: all(started), waiting: false, count: started, total },
    { id: 'plans', done: all(withPlan), waiting: false, count: withPlan, total },
  ]
}

export const doneCount = (steps: Step<string>[]): number => steps.filter((s) => s.done).length
export const allDone = (steps: Step<string>[]): boolean => steps.every((s) => s.done)

/** The step to highlight: the first one not done that the viewer can act on (null when only waiting ones are left). */
export function currentStep<Id extends string>(steps: Step<Id>[]): Id | null {
  return steps.find((s) => !s.done && !s.waiting)?.id ?? null
}

export type ChecklistView = 'hidden' | 'list' | 'allSet'

/**
 * What the checklist card shows: nothing once dismissed, and nothing for someone who was already set up when
 * they first saw Home (the demo squad, or a returning user); the list while steps are open; and an "all set"
 * card, until dismissed, for someone who saw the list and has now finished it (even on a later visit).
 */
export function checklistView(steps: Step<string>[], seen: boolean, dismissed: boolean): ChecklistView {
  if (dismissed) return 'hidden'
  if (!allDone(steps)) return 'list'
  return seen ? 'allSet' : 'hidden'
}
