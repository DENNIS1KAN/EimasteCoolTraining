import { Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { useMe, useStatus } from '../data/store'

import { AppShell } from './AppShell'
import { lazyPage as lazy } from './appUpdate'
import { BootScreen, ErrorScreen } from './BootScreens'
import { PageErrorBoundary } from './PageErrorBoundary'

// Feature pages are code-split; each feature owns its folder under src/features/.
// lazyPage: a chunk that vanished with a new deploy reloads the app once instead of crashing it.
const HomePage = lazy(() => import('../features/home/HomePage'))
const TrainPage = lazy(() => import('../features/train/TrainPage'))
const LiftHistoryPage = lazy(() => import('../features/train/LiftHistoryPage'))
const BodyPage = lazy(() => import('../features/body/BodyPage'))
const FuelPage = lazy(() => import('../features/fuel/FuelPage'))
const SquadPage = lazy(() => import('../features/squad/SquadPage'))
const ComparePage = lazy(() => import('../features/squad/ComparePage'))
const MemberPage = lazy(() => import('../features/squad/MemberPage'))
const MemberWorkoutPage = lazy(() => import('../features/squad/MemberWorkoutPage'))
const CoachPage = lazy(() => import('../features/coach/CoachPage'))
const CoachMemberPage = lazy(() => import('../features/coach/CoachMemberPage'))
const CoachProgramPage = lazy(() => import('../features/coach/CoachProgramPage'))
const MealPlanEditorPage = lazy(() => import('../features/fuel/MealPlanEditorPage'))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'))
const LoginPage = lazy(() => import('../features/auth/LoginPage'))
const JoinPage = lazy(() => import('../features/auth/JoinPage'))
const DevPage = lazy(() => import('../dev/DevPage'))

function RequireCoach({ children }: { children: ReactNode }) {
  const me = useMe()
  if (!me) return null
  return me.role === 'coach' ? <>{children}</> : <Navigate to="/" replace />
}

/**
 * Route map (hash-based, so it works on GitHub Pages without server rewrites):
 *   /login, /join/:slug?code=XXXX                     auth
 *   /                                                 home dashboard
 *   /train, /train/:week/:day                         workout logger (defaults to the next workout)
 *   /lift/:slug/:exercise                             one exercise's history for a member
 *   /body                                             weight log + charts
 *   /fuel                                             meal plan + daily check-in
 *   /squad?tab=overview|league|feed                   everyone's progress
 *   /squad/compare?a=<slug>&b=<slug>                  head to head
 *   /member/:slug, /member/:slug/workout/:week/:day   a member's profile / one of their workouts (read-only)
 *   /coach?tab=members|nutrition|programs             coach console
 *   /coach/member/:slug                               edit a member (goal, program, note, invite)
 *   /coach/plan/:slug/:planId                         meal plan editor ("new" to create)
 *   /coach/program/:id                                view/import a program
 *   /settings
 */
export function App() {
  // Subscribing here re-renders the whole tree top-down on a language switch, so text formatted outside useT
  // (dates, numbers) updates too.
  const status = useStatus()

  if (status === 'booting') return <BootScreen />
  if (status === 'error') return <ErrorScreen />

  // The router is NOT keyed by language: a language switch re-renders in place (useT subscribes to it), so open
  // forms and editors keep what was typed.
  return (
    <HashRouter>
      <Suspense fallback={<BootScreen quiet />}>
        {status === 'signed-out' ? (
          <PageErrorBoundary>
            <Routes>
              <Route path="/join/:slug" element={<JoinPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={<LoginPage />} />
            </Routes>
          </PageErrorBoundary>
        ) : (
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="train" element={<TrainPage />} />
              <Route path="train/:week/:day" element={<TrainPage />} />
              <Route path="lift/:slug/:exercise" element={<LiftHistoryPage />} />
              <Route path="body" element={<BodyPage />} />
              <Route path="fuel" element={<FuelPage />} />
              <Route path="squad" element={<SquadPage />} />
              <Route path="squad/compare" element={<ComparePage />} />
              <Route path="member/:slug" element={<MemberPage />} />
              <Route path="member/:slug/workout/:week/:day" element={<MemberWorkoutPage />} />
              <Route path="coach" element={<RequireCoach><CoachPage /></RequireCoach>} />
              <Route path="coach/member/:slug" element={<RequireCoach><CoachMemberPage /></RequireCoach>} />
              <Route path="coach/plan/:slug/:planId" element={<RequireCoach><MealPlanEditorPage /></RequireCoach>} />
              <Route path="coach/program/:id" element={<RequireCoach><CoachProgramPage /></RequireCoach>} />
              <Route path="settings" element={<SettingsPage />} />
              {import.meta.env.DEV && <Route path="dev/:page" element={<DevPage />} />}
              <Route path="login" element={<Navigate to="/" replace />} />
              <Route path="join/*" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        )}
      </Suspense>
    </HashRouter>
  )
}
