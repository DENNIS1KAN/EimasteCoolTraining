import { useMe } from '../../data/store'
import { AthleteHome } from './AthleteHome'
import { CoachHome } from './CoachHome'
import './home.css'

/**
 * Home dashboard (route "/"). Athletes, and a coach who trains the program too (every member competes by default),
 * get the athlete home; a coach switched off from competing, or without a program, gets the squad view.
 */
export default function HomePage() {
  const me = useMe()
  if (!me) return null
  const coachView = me.role === 'coach' && (!me.competes || !me.programId)
  return coachView ? <CoachHome me={me} /> : <AthleteHome me={me} />
}
