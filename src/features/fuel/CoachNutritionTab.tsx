import { useMemo, useState, type JSX } from 'react'
import { Link } from 'react-router'
import type { MealPlan, Member, NutritionCheckin } from '../../data/types'
import { useStore } from '../../data/store'
import { useT } from '../../i18n'
import { addDays, todayISO, type ISODate } from '../../lib/dates'
import { fmtDate, fmtDayLabel, fmtNum } from '../../lib/format'
import { currentPlan } from '../../lib/stats'
import { Avatar, ButtonLink, Card, EmptyState, Icon, Tag, useIsDesktop } from '../../ui'
import { heatFill } from '../../ui/charts'
import { editorPath } from './access'
import { byNewest, useNow } from './hooks'
import { fuelDays, lastCheckinDate, recentAdherence, type FuelDay } from './lib/adherence'
import { FM } from './messages'
import './fuel.css'
import './fuel-coach.css'

interface Row {
  member: Member
  plans: MealPlan[]
  plan: MealPlan | null
  ratio: number | null
  days: FuelDay[]
  last: ISODate | null
  lastDay: FuelDay | null
  lastNote: string
}

function buildRows(
  members: Record<string, Member>,
  mealPlans: Record<string, MealPlan>,
  checkins: Record<string, NutritionCheckin>,
  today: ISODate,
): Row[] {
  const plansAll = Object.values(mealPlans)
  const cis = Object.values(checkins)
  const athletes = Object.values(members)
    .filter((m) => m.role === 'athlete')
    .sort((a, b) => a.name.localeCompare(b.name))
  return athletes.map((member) => {
    const plans = plansAll.filter((p) => p.memberId === member.id).sort(byNewest)
    const plan = currentPlan(plans, member.id)
    const mine = cis.filter((c) => c.memberId === member.id)
    const a = recentAdherence(mine, plan, today, 14)
    const last = lastCheckinDate(mine, member.id)
    const recentNote = mine.filter((c) => c.note.trim() && c.date >= addDays(today, -6)).sort((x, y) => (x.date < y.date ? 1 : -1))[0]
    return {
      member,
      plans,
      plan,
      ratio: a && a.days > 0 ? a.ratio : null,
      days: fuelDays(mine, mealPlans, plan, addDays(today, -13), today, today),
      last,
      lastDay: last ? (fuelDays(mine, mealPlans, plan, last, last, today)[0] ?? null) : null,
      lastNote: recentNote ? recentNote.note.trim() : '',
    }
  })
}

function Strip({ days }: { days: FuelDay[] }) {
  return (
    <span className="fu-cn__strip" aria-hidden="true">
      {days.map((d) => (
        <i
          key={d.date}
          className={d.value == null ? 'is-empty' : undefined}
          style={d.value == null ? undefined : { background: heatFill('var(--heat)', d.value <= 0 ? 0 : Math.ceil(d.value * 4 - 1e-9)) }}
        />
      ))}
    </span>
  )
}

function AthleteCard({ row, today }: { row: Row; today: ISODate }) {
  const t = useT(FM)
  const [open, setOpen] = useState(false)
  const { member, plan } = row
  const older = row.plans.filter((p) => p !== plan)
  const lastLabel = row.last ? fmtDayLabel(row.last) : t('never')
  const stale = !row.last || row.last < addDays(today, -2)
  const daySummaryText = (d: FuelDay) =>
    [d.rating ? t(d.rating) : null, d.total > 0 ? t('mealsOf', { x: d.ticked, y: d.total }) : null].filter(Boolean).join(' · ')
  return (
    <Card as="section" className="fu-cn" aria-labelledby={`fu-cn-${member.id}`}>
      <div className="fu-cn__head">
        <Avatar member={member} size={40} decorative />
        <div className="fu-cn__who">
          <h3 id={`fu-cn-${member.id}`} className="fu-cn__name">
            {member.name}
          </h3>
          <p className="fu-cn__plan">
            {plan ? (
              <>
                <span className="fu-cn__title">{plan.title}</span>
                <span className="fu-cn__since"> · {t('since', { date: fmtDate(plan.startDate) })}</span>
              </>
            ) : (
              t('noActivePlan')
            )}
          </p>
        </div>
        {plan?.active && (
          <Tag tone="good" icon="check">
            {t('activeTag')}
          </Tag>
        )}
      </div>

      {plan ? (
        <div className="fu-cn__stats">
          <div className="fu-cn__stat">
            <p className="fu-cn__v num">
              {row.ratio == null ? '–' : fmtNum(row.ratio * 100, 0)}
              {row.ratio != null && <small>%</small>}
            </p>
            <p className="fu-cn__l">{t('adherence14')}</p>
            <Strip days={row.days} />
          </div>
          <div className="fu-cn__stat">
            <p className={`fu-cn__v fu-cn__v--text${stale ? ' is-stale' : ''}`}>
              {stale && <Icon name="alert" size={14} />}
              {lastLabel}
            </p>
            <p className="fu-cn__l">{t('lastCheckin')}</p>
            {row.lastDay && <p className="fu-cn__lastsum">{daySummaryText(row.lastDay)}</p>}
          </div>
        </div>
      ) : (
        <p className="fu-cn__hint">{t('noPlanHint', { name: member.name })}</p>
      )}

      {row.lastNote && (
        <p className="fu-cn__note">
          <Icon name="message" size={14} />
          <span>“{row.lastNote}”</span>
        </p>
      )}

      <div className="fu-cn__actions">
        {plan && (
          <ButtonLink to={editorPath(member.slug, plan.id)} variant="secondary" size="sm" icon="edit">
            {t('editPlan')}
          </ButtonLink>
        )}
        <ButtonLink to={editorPath(member.slug, 'new')} variant={plan ? 'ghost' : 'secondary'} size="sm" icon="plus">
          {t('newPlan')}
        </ButtonLink>
      </div>

      {older.length > 0 && (
        <button type="button" className="fu-cn__hist" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="history" size={16} />
          <span className="fu-cn__histl">{t('history')}</span>
          <span className="fu-cn__histn num">{older.length}</span>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
        </button>
      )}
      {open && older.length > 0 && (
        <ul className="fu-cn__list">
          {older.map((p) => (
            <li key={p.id}>
              <Link to={editorPath(member.slug, p.id)} className="fu-cn__item">
                <span className="fu-cn__itemt">{p.title}</span>
                <span className="fu-cn__itemd">{fmtDate(p.startDate, 'medium')}</span>
                <Icon name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Coach console tab: every athlete's plan, 14-day adherence and last check-in, with shortcuts to the editor. */
export default function CoachNutritionTab(): JSX.Element {
  const t = useT(FM)
  const members = useStore((s) => s.members)
  const mealPlans = useStore((s) => s.mealPlans)
  const checkins = useStore((s) => s.checkins)
  const today = todayISO(useNow())
  const isDesktop = useIsDesktop()
  const rows = useMemo(() => buildRows(members, mealPlans, checkins, today), [members, mealPlans, checkins, today])

  if (!rows.length) {
    return (
      <Card className="fu-embed">
        <EmptyState icon="users" title={t('noAthletes')} body={t('noAthletesBody')} />
      </Card>
    )
  }
  return (
    <div className={`fu-embed fu-cn-list${isDesktop ? ' is-wide' : ''}`}>
      {rows.map((r) => (
        <AthleteCard key={r.member.id} row={r} today={today} />
      ))}
    </div>
  )
}
