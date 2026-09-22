import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { CheckinRating, NutritionCheckin } from '../../data/types'
import { useMe, useStore } from '../../data/store'
import { useT } from '../../i18n'
import { addDays, todayISO } from '../../lib/dates'
import { fmtDate, fmtDayLabel } from '../../lib/format'
import { onPlanStreak } from '../../lib/stats'
import { Banner, Button, ButtonLink, Card, EmptyState, Icon, PageHeader, celebrate, toast, useIsDesktop } from '../../ui'
import { canEditPlans, editorPath } from './access'
import { AdherenceCard } from './AdherenceCard'
import { CheckinCard } from './CheckinCard'
import { DayStrip } from './DayStrip'
import { saveCheckin, useFuelData, useNow } from './hooks'
import { fuelDays, heatRange, loggedAverage, ratingStreak, recentAdherence } from './lib/adherence'
import { blankCheckin, daySummary, minutesOf, nextMealId, nextRating, planOnDate, toggleMeal } from './lib/day'
import { MealsCard } from './MealsCard'
import { FM } from './messages'
import { OlderPlans } from './OlderPlans'
import { PlanCard } from './PlanCard'
import { TargetsCard } from './TargetsCard'
import './fuel.css'

const DAYS_BACK = 6

/** Fuel: the viewer's meal plan and today's nutrition check-in (meals, rating, water), plus adherence. */
export default function FuelPage() {
  const t = useT(FM)
  const me = useMe()
  const members = useStore((s) => s.members)
  const now = useNow()
  const today = todayISO(now)
  const isDesktop = useIsDesktop()
  const [picked, setPicked] = useState<string | null>(null)
  const date = picked && picked < today && picked >= addDays(today, -DAYS_BACK) ? picked : today
  const data = useFuelData(me?.id)

  const checkin = data.byDate.get(date) ?? null
  const plan = planOnDate(data.plans, data.current, date, checkin)
  const ticked = useMemo(() => checkin?.meals ?? [], [checkin])
  const summary = useMemo(() => daySummary(plan, ticked), [plan, ticked])
  const nextId = date === today && plan ? nextMealId(plan.meals, ticked, minutesOf(now)) : null

  const heat = useMemo(() => {
    const r = heatRange(today, 4)
    const days = fuelDays(data.checkins, data.allPlans, data.current, r.from, r.to, today)
    if (!data.current) return { days, ratio: loggedAverage(days), streak: ratingStreak(data.checkins, today) }
    const a = recentAdherence(data.checkins, data.current, today, 28)
    return { days, ratio: a && a.days > 0 ? a.ratio : null, streak: onPlanStreak(data.checkins, data.current, today) }
  }, [data, today])

  if (!me) return null

  const isToday = date === today
  const write = (fn: (c: NutritionCheckin) => NutritionCheckin, opts?: { debounceMs?: number }) => {
    const base = checkin ?? blankCheckin(me.id, date, plan?.id ?? null)
    const next = fn(base)
    saveCheckin(next, !!checkin, opts)
    return next
  }
  const onToggle = (mealId: string) => {
    if (!plan) return
    const wasDone = ticked.includes(mealId)
    const next = write((c) => toggleMeal(c, mealId, plan.id))
    const all = plan.meals.length > 1 && plan.meals.every((m) => next.meals.includes(m.id))
    if (!wasDone && all && isToday) {
      celebrate({ intensity: 'small' })
      toast(t('allMealsDone'), { tone: 'good' })
    }
  }
  const onRate = (r: CheckinRating) => write((c) => ({ ...c, planId: c.planId ?? plan?.id ?? null, rating: nextRating(c.rating, r) }))
  const onWater = (l: number) => write((c) => ({ ...c, waterL: l > 0 ? l : null }))
  const onNote = (text: string) => write((c) => ({ ...c, note: text }), { debounceMs: 600 })

  const canEdit = canEditPlans(me, me.id)
  const editTo = data.current && canEdit ? editorPath(me.slug, data.current.id) : null
  const author = data.current ? (members[data.current.createdBy] ?? null) : null
  const dayStatus = (d: string) => {
    const c = data.byDate.get(d)
    if (!c) return null
    const p = planOnDate(data.plans, data.current, d, c)
    const s = daySummary(p, c.meals)
    const full = c.rating === 'on' || (s.mealsTotal > 0 && s.mealsTicked === s.mealsTotal)
    return full ? 'full' : 'part'
  }

  const header = (
    <PageHeader
      eyebrow={`${fmtDate(today, 'weekday')} ${fmtDate(today, 'dayMonth')}`.replace('.', '')}
      title={t('title')}
      account
      actions={
        editTo ? (
          <Link to={editTo} className="ui-iconbtn ui-iconbtn--soft" aria-label={t('editPlan')} style={{ ['--ib-size' as string]: '44px' }}>
            <Icon name="edit" size={20} />
          </Link>
        ) : undefined
      }
    />
  )

  const planBlock: ReactNode = data.current ? (
    <PlanCard key="plan" plan={data.current} author={author} meId={me.id} notesOpen={isDesktop} />
  ) : (
    <Card key="plan" as="section" className="fu-empty">
      <EmptyState
        compact
        icon="fuel"
        title={t('emptyTitle')}
        body={me.role === 'coach' ? t('emptyCoach') : t('emptyAthlete')}
        action={
          me.role === 'coach' || canEdit ? (
            <div className="fu-empty__actions">
              <ButtonLink to={editorPath(me.slug, 'new')} icon="plus" size="md">
                {t('createMine')}
              </ButtonLink>
              {me.role === 'coach' && (
                <ButtonLink to="/coach?tab=nutrition" variant="ghost" size="md">
                  {t('squadPlans')}
                </ButtonLink>
              )}
            </div>
          ) : undefined
        }
      />
    </Card>
  )

  const dayLabel = fmtDayLabel(date, now)
  const dayBlocks: ReactNode[] = [
    <DayStrip key="strip" today={today} value={date} onChange={(d) => setPicked(d === today ? null : d)} status={dayStatus} days={DAYS_BACK + 1} />,
    !isToday && (
      <Banner
        key="past"
        tone="info"
        icon="calendar"
        role="status"
        action={
          <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
            {t('backToToday')}
          </Button>
        }
      >
        {t('editingPast', { day: fmtDate(date, 'long') })}
      </Banner>
    ),
    plan && <TargetsCard key="targets" summary={summary} />,
    plan && plan.meals.length > 0 && (
      <MealsCard
        key="meals"
        title={isToday ? t('todaysMeals') : t('mealsOfDay', { day: dayLabel })}
        meals={plan.meals}
        ticked={ticked}
        nextId={nextId}
        onToggle={onToggle}
      />
    ),
    <CheckinCard
      key="checkin"
      isToday={isToday}
      rating={checkin?.rating ?? null}
      waterL={checkin?.waterL ?? null}
      waterTargetL={plan?.waterL ?? null}
      note={checkin?.note ?? ''}
      onRate={onRate}
      onWater={onWater}
      onNote={onNote}
    />,
  ]
  const historyBlocks: ReactNode[] = [
    (data.current || data.checkins.length > 0) && <AdherenceCard key="adh" days={heat.days} ratio={heat.ratio} streak={heat.streak} />,
    <OlderPlans key="older" plans={data.older} all={data.plans} editLink={canEdit ? (p) => editorPath(me.slug, p.id) : undefined} />,
  ]

  if (isDesktop) {
    return (
      <div className="fu-page">
        {header}
        <div className="fu-cols">
          <div className="stack">{dayBlocks}</div>
          <div className="stack">
            {planBlock}
            {historyBlocks}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="fu-page stack">
      {header}
      {planBlock}
      {dayBlocks}
      {historyBlocks}
    </div>
  )
}
