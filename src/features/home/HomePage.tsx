import { useMe } from '../../data/store'
import { AthleteHome } from './AthleteHome'
import { CoachHome } from './CoachHome'
import './home.css'

/**
 * Home dashboard (route "/"). Athletes, and a coach who trains the program too, get the athlete home;
 * a coach who only coaches gets the squad view.
 */
export default function HomePage() {
  const me = useMe()
  if (!me) return null
  const coachView = me.role === 'coach' && (!me.competes || !me.programId)
  return coachView ? <CoachHome me={me} /> : <AthleteHome me={me} />
}
