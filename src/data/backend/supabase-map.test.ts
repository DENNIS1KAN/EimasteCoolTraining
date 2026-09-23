import { describe, expect, it } from 'vitest'
import type { Cheer, MealPlan, Member, NutritionCheckin, Program, WeightEntry, WorkoutLog } from '../types'
import { TABLES } from '../types'
import { BackendError } from './types'
import {
  SQL_TABLE,
  changeFromPayload,
  contentTypeFor,
  fromRow,
  isUserAlreadyExists,
  joinEmail,
  loginProfileFromRpc,
  memberFromRow,
  memberPatch,
  safeFileName,
  tableFromSql,
  toBackendError,
  toRow,
} from './supabase-map'

const ME = '6f1c3c5e-2a7b-4c1d-9e8f-0a1b2c3d4e5f'
const YOU = '0e9d8c7b-6a5f-4e3d-8c2b-1a0f9e8d7c6b'

const member: Member = {
  id: ME,
  slug: 'stelios',
  name: 'Stelios',
  role: 'athlete',
  color: 'blue',
  competes: true,
  goal: 'Bench 100',
  goalWeightKg: 80,
  heightCm: 181,
  programId: 'bts-12',
  programStart: '2026-09-07',
  coachNote: 'Nice',
  coachNoteAt: 5,
  settings: { unit: 'kg', machines: { 'Leg Press': 'Hammer' }, weightVisibility: 'exact' },
  joined: true,
  updatedAt: 1700000000000,
}

const log: WorkoutLog = {
  id: `${ME}__bts-12__w1d0`,
  memberId: ME,
  programId: 'bts-12',
  week: 1,
  day: 0,
  unit: 'kg',
  ex: { '0': { v: 0, m: '', sets: [{ w: '80', r: '8', ok: true, at: 1 }] } },
  done: true,
  doneAt: 2,
  startedAt: 1,
  feel: 4,
  note: '',
  updatedAt: 10,
}
const weight: WeightEntry = { id: `${ME}__2026-09-01`, memberId: ME, date: '2026-09-01', kg: 82.4, bodyFat: null, waistCm: null, note: '', updatedAt: 11 }
const checkin: NutritionCheckin = {
  id: `${ME}__2026-09-01`,
  memberId: ME,
  date: '2026-09-01',
  planId: 'p1',
  meals: ['m1'],
  rating: 'on',
  waterL: 2,
  note: '',
  updatedAt: 12,
}
const plan: MealPlan = {
  id: 'p1',
  memberId: ME,
  title: 'Cut',
  notes: '',
  startDate: '2026-09-01',
  kcal: 2200,
  protein: 180,
  carbs: null,
  fat: null,
  waterL: 3,
  meals: [],
  files: [],
  active: true,
  createdBy: YOU,
  createdAt: 1,
  updatedAt: 13,
}
const cheer: Cheer = { id: 'c1', fromId: ME, toId: YOU, kind: 'kudos', ref: null, emoji: '🔥', text: 'Beast', createdAt: 5, seenAt: null, updatedAt: 14 }
const program: Program = { id: 'custom', name: 'Deload', description: '', weeks: [], schedule: [0, null, null, null, null, null, null], builtIn: true, createdBy: YOU, updatedAt: 15 }

describe('table names', () => {
  it('maps every client table to its SQL table and back', () => {
    expect(SQL_TABLE).toEqual({
      members: 'members',
      programs: 'programs',
      logs: 'workout_logs',
      weights: 'weights',
      mealPlans: 'meal_plans',
      checkins: 'checkins',
      cheers: 'cheers',
    })
    for (const t of TABLES) expect(tableFromSql(SQL_TABLE[t])).toBe(t)
    expect(tableFromSql('member_invites')).toBeNull()
  })
})

describe('members', () => {
  it('builds a member from columns + data, with defaults for missing fields', () => {
    const m = memberFromRow({ id: ME, slug: 'thanos', role: 'athlete', user_id: null, data: { name: 'Thanos', color: 'orange' }, updated_at: '42' })
    expect(m).toEqual({
      id: ME,
      slug: 'thanos',
      name: 'Thanos',
      role: 'athlete',
      color: 'orange',
      competes: true,
      goal: '',
      goalWeightKg: null,
      heightCm: null,
      programId: 'bts-12',
      programStart: null,
      coachNote: '',
      coachNoteAt: null,
      settings: { unit: 'kg', machines: {}, weightVisibility: 'exact' },
      joined: false,
      updatedAt: 42,
    })
  })

  it('lets columns win over data and merges partial settings', () => {
    const m = memberFromRow({
      id: ME,
      slug: 'dennis',
      role: 'coach',
      user_id: YOU,
      data: { id: 'x', slug: 'x', role: 'athlete', joined: false, color: 'hotpink', competes: false, settings: { unit: 'lb' } },
      updated_at: 7,
    })
    expect(m).toMatchObject({ id: ME, slug: 'dennis', role: 'coach', joined: true, updatedAt: 7, name: 'dennis', color: 'blue', competes: false })
    expect(m.settings).toEqual({ unit: 'lb', machines: {}, weightVisibility: 'exact' })
  })

  it('writes only the profile data and timestamp', () => {
    const patch = memberPatch(member)
    expect(patch.updated_at).toBe(member.updatedAt)
    for (const k of ['id', 'slug', 'role', 'joined', 'updatedAt']) expect(patch.data).not.toHaveProperty(k)
    expect(patch.data).toMatchObject({ name: 'Stelios', goal: 'Bench 100', coachNote: 'Nice', settings: member.settings })
    expect(toRow('members', member)).toEqual({ id: ME, ...patch })
  })

  it('round-trips a member', () => {
    const { data, updated_at } = memberPatch(member)
    expect(memberFromRow({ id: ME, slug: 'stelios', role: 'athlete', user_id: YOU, data, updated_at })).toEqual(member)
  })
})

describe('row mapping', () => {
  it('adds the columns RLS and uniqueness need', () => {
    expect(toRow('logs', log)).toEqual({ id: log.id, member_id: ME, data: log, updated_at: 10 })
    expect(toRow('weights', weight)).toEqual({ id: weight.id, member_id: ME, date: '2026-09-01', data: weight, updated_at: 11 })
    expect(toRow('checkins', checkin)).toEqual({ id: checkin.id, member_id: ME, date: '2026-09-01', data: checkin, updated_at: 12 })
    expect(toRow('mealPlans', plan)).toEqual({ id: 'p1', member_id: ME, data: plan, updated_at: 13 })
    expect(toRow('cheers', cheer)).toEqual({ id: 'c1', from_id: ME, to_id: YOU, created_at: 5, data: cheer, updated_at: 14 })
  })

  it('stores programs as not built-in and only links real member ids', () => {
    expect(toRow('programs', program)).toEqual({ id: 'custom', created_by: YOU, data: { ...program, builtIn: false }, updated_at: 15 })
    expect(toRow('programs', { ...program, createdBy: 'demo-dennis' }).created_by).toBeNull()
    expect(toRow('programs', { ...program, createdBy: null }).created_by).toBeNull()
  })

  it('round-trips every data table', () => {
    const cases = [
      ['logs', log],
      ['weights', weight],
      ['checkins', checkin],
      ['mealPlans', plan],
      ['cheers', cheer],
    ] as const
    for (const [table, row] of cases) {
      const json = JSON.parse(JSON.stringify(toRow(table, row)))
      expect(fromRow(table, json)).toEqual(row)
    }
    const p = JSON.parse(JSON.stringify(toRow('programs', program)))
    expect(fromRow('programs', p)).toEqual({ ...program, builtIn: false })
  })

  it('takes id and updatedAt from the columns (bigint may arrive as a string)', () => {
    expect(fromRow('logs', { id: 'a', data: { ...log, id: 'b', updatedAt: 1 }, updated_at: '99' })).toMatchObject({ id: 'a', updatedAt: 99 })
  })

  it('skips rows without a data object', () => {
    expect(fromRow('logs', { id: 'a', data: null, updated_at: 1 })).toBeNull()
    expect(fromRow('weights', { id: 'a', updated_at: 1 })).toBeNull()
  })
})

describe('realtime payloads', () => {
  it('maps inserts and updates to put events', () => {
    const row = JSON.parse(JSON.stringify(toRow('weights', weight)))
    expect(changeFromPayload({ eventType: 'INSERT', table: 'weights', new: row, old: {} })).toEqual({ table: 'weights', type: 'put', row: weight })
    const m = { id: ME, slug: 'stelios', role: 'athlete', user_id: null, login_email: null, ...memberPatch(member) }
    expect(changeFromPayload({ eventType: 'UPDATE', table: 'members', new: m, old: { id: ME } })).toEqual({
      table: 'members',
      type: 'put',
      row: { ...member, joined: false },
    })
  })

  it('maps deletes to remove events by id', () => {
    expect(changeFromPayload({ eventType: 'DELETE', table: 'workout_logs', new: {}, old: { id: log.id } })).toEqual({
      table: 'logs',
      type: 'remove',
      id: log.id,
    })
  })

  it('ignores unknown tables and payloads without data', () => {
    expect(changeFromPayload({ eventType: 'INSERT', table: 'member_invites', new: { id: 'x' }, old: {} })).toBeNull()
    expect(changeFromPayload({ eventType: 'UPDATE', table: 'programs', new: { id: 'x' }, old: {} })).toBeNull()
    expect(changeFromPayload({ eventType: 'DELETE', table: 'cheers', new: {}, old: {} })).toBeNull()
  })
})

describe('login helpers', () => {
  it('maps login_profiles rows', () => {
    expect(
      loginProfileFromRpc({ id: ME, slug: 'stelios', name: 'Stelios', color: 'blue', role: 'athlete', joined: true, login_email: 'stelios-abc234@x.app' }),
    ).toEqual({ id: ME, slug: 'stelios', name: 'Stelios', color: 'blue', role: 'athlete', joined: true, loginEmail: 'stelios-abc234@x.app' })
    expect(loginProfileFromRpc({ id: ME, slug: 'x1', name: '', color: 'nope', role: 'boss', joined: null, login_email: null })).toEqual({
      id: ME,
      slug: 'x1',
      name: 'x1',
      color: 'blue',
      role: 'athlete',
      joined: false,
      loginEmail: null,
    })
  })

  it('derives the hidden join e-mail from slug and code', () => {
    expect(joinEmail('stelios', 'ABC234', 'eimastecool.app')).toBe('stelios-abc234@eimastecool.app')
    expect(joinEmail(' Stelios ', ' abc-234 ', 'EimasteCool.app')).toBe('stelios-abc234@eimastecool.app')
    expect(joinEmail('stelios', ' - ', 'eimastecool.app')).toBe('')
    expect(joinEmail('', 'ABC234', 'eimastecool.app')).toBe('')
  })

  it('recognises "user already exists" sign-up errors', () => {
    expect(isUserAlreadyExists({ code: 'user_already_exists', message: 'User already registered' })).toBe(true)
    expect(isUserAlreadyExists({ message: 'User already registered' })).toBe(true)
    expect(isUserAlreadyExists({ code: 'weak_password', message: 'Password should be at least 6 characters.' })).toBe(false)
  })
})

describe('file helpers', () => {
  it('makes storage-safe names that keep the extension', () => {
    expect(safeFileName('Diet plan (v2).pdf')).toBe('Diet_plan_v2.pdf')
    expect(safeFileName('scan.PDF')).toBe('scan.pdf')
    expect(safeFileName('...')).toBe('file')
    expect(safeFileName('Πρόγραμμα διατροφής.pdf')).toBe('file.pdf')
    expect(safeFileName('Café menu.jpg')).toBe('Cafe_menu.jpg')
    expect(safeFileName(`${'a'.repeat(200)}.png`)).toHaveLength(80)
    expect(safeFileName(`${'a'.repeat(200)}.png`).endsWith('.png')).toBe(true)
  })

  it('fills in content types the browser left out', () => {
    expect(contentTypeFor('IMG_0001.HEIC', '')).toBe('image/heic')
    expect(contentTypeFor('plan.pdf', 'application/octet-stream')).toBe('application/pdf')
    expect(contentTypeFor('photo.jpg', 'image/jpg')).toBe('image/jpeg')
    expect(contentTypeFor('photo.heif', 'image/heif')).toBe('image/heic')
    expect(contentTypeFor('notes.txt', 'text/plain')).toBe('text/plain')
    expect(contentTypeFor('archive.zip', '')).toBe('application/octet-stream')
  })
})

describe('toBackendError', () => {
  const code = (e: unknown, status?: number) => toBackendError(e, status).code

  it('treats lost connections and timeouts as network errors', () => {
    expect(code(new TypeError('Failed to fetch'))).toBe('network')
    expect(code(new TypeError('NetworkError when attempting to fetch resource.'))).toBe('network')
    expect(code(new TypeError('Load failed'))).toBe('network')
    expect(code({ message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, 0)).toBe('network')
    expect(code(new DOMException('The operation was aborted.', 'AbortError'))).toBe('network')
    expect(code({ name: 'AuthRetryableFetchError', message: '{}', status: 0 })).toBe('network')
    expect(code({ name: 'StorageUnknownError', message: 'fetch error', originalError: new TypeError('Failed to fetch') })).toBe('network')
    expect(code({ message: 'upstream', code: '' }, 503)).toBe('network')
    expect(code({ message: 'canceling statement due to statement timeout', code: '57014' }, 500)).toBe('network')
  })

  it('maps authentication failures', () => {
    expect(code({ name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' })).toBe('auth')
    expect(code({ message: 'JWT expired', code: 'PGRST303' }, 401)).toBe('auth')
    expect(code({ message: 'JWT expired', code: 'PGRST301' })).toBe('auth')
    expect(code({ name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 })).toBe('auth')
  })

  it('maps row-level security refusals', () => {
    expect(code({ message: 'permission denied for table members', code: '42501' })).toBe('forbidden')
    // PostgREST answers 401 when the request arrived without a valid session (as anon): that is a sign-in problem.
    expect(code({ message: 'permission denied for table members', code: '42501' }, 401)).toBe('auth')
    expect(code({ message: 'new row violates row-level security policy for table "weights"', code: '42501' }, 403)).toBe('forbidden')
    expect(code({ name: 'StorageApiError', message: 'new row violates row-level security policy', status: 400, statusCode: '403' })).toBe(
      'forbidden',
    )
    expect(code({ message: 'forbidden', code: '42501' }, 403)).toBe('forbidden')
  })

  it('maps the exceptions raised by the SQL functions', () => {
    expect(code({ message: 'invalid_invite', code: 'P0001' }, 400)).toBe('invalid_invite')
    expect(code({ message: 'already_joined', code: 'P0001' }, 400)).toBe('already_joined')
    expect(code({ message: 'already_linked', code: 'P0001' }, 400)).toBe('conflict')
    expect(code({ message: 'slug_taken', code: '23505' }, 409)).toBe('conflict')
    expect(code({ message: 'not_found', code: 'P0002' }, 404)).toBe('not_found')
    expect(toBackendError({ message: 'already_linked' }).message).toMatch(/another member/)
  })

  it('maps password and sign-up problems', () => {
    expect(code({ name: 'AuthWeakPasswordError', code: 'weak_password', message: 'Password should be at least 6 characters.', status: 422 })).toBe(
      'weak_password',
    )
    expect(code({ message: 'Password should be at least 8 characters.', status: 422 })).toBe('weak_password')
    expect(code({ message: 'New password should be different from the old password.', code: 'same_password' })).toBe('weak_password')
    expect(code({ message: 'Email not confirmed', code: 'email_not_confirmed', status: 400 })).toBe('email_confirmation_on')
    expect(code({ message: 'Signups not allowed for this instance', code: 'signup_disabled', status: 422 })).toBe('forbidden')
  })

  it('maps size, conflict and missing rows', () => {
    expect(code({ name: 'StorageApiError', message: 'The object exceeded the maximum allowed size', status: 413, statusCode: '413' })).toBe(
      'too_large',
    )
    expect(code({ message: 'duplicate key value violates unique constraint "weights_member_id_date_key"', code: '23505' }, 409)).toBe('conflict')
    expect(code({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, 406)).toBe('not_found')
    expect(code({ name: 'StorageApiError', message: 'Object not found', status: 400, statusCode: '404' })).toBe('not_found')
  })

  it('keeps the original message for anything else', () => {
    const e = toBackendError({ message: 'new row for relation "weights" violates check constraint', code: '23514' }, 400)
    expect(e).toBeInstanceOf(BackendError)
    expect(e.code).toBe('unknown')
    expect(e.message).toMatch(/check constraint/)
    expect(toBackendError('boom')).toMatchObject({ code: 'unknown', message: 'boom' })
    expect(toBackendError(undefined).code).toBe('unknown')
    expect(toBackendError(null).code).toBe('unknown')
  })

  it('passes BackendErrors through untouched', () => {
    const e = new BackendError('too_large', 'big')
    expect(toBackendError(e)).toBe(e)
  })
})
