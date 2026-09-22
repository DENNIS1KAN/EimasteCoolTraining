import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Member } from '../../data/types'
import { useT } from '../../i18n'
import { fmtDate } from '../../lib/format'
import { Button, Card, Icon, IconButton, Tag, memberColorVar } from '../../ui'
import { GoalSheet } from './GoalSheet'
import type { WeightModel } from './hooks'
import { maintainGauge } from './logic'
import { M } from './messages'
import { wAbs, wNum, wText } from './format'

/** Start → current → goal, with the percentage, what's left and an ETA. Invites setting a goal when there is none. */
export function GoalCard({ member, model, editable }: { member: Member; model: WeightModel; editable: boolean }) {
  const t = useT(M)
  const [open, setOpen] = useState(false)
  const unit = member.settings.unit
  const g = model.goal
  const goalKg = member.goalWeightKg
  const sheet = editable ? <GoalSheet open={open} onClose={() => setOpen(false)} member={member} currentKg={model.stats?.trendKg ?? null} /> : null

  if (goalKg == null) {
    if (!editable) return null
    return (
      <Card as="section" className="body-goal body-goal--empty" aria-labelledby="body-goal-title">
        <span className="body-goal__icon" aria-hidden="true">
          <Icon name="target" size={22} />
        </span>
        <div className="body-goal__text">
          <h2 className="body-goal__title" id="body-goal-title">
            {t('setGoal')}
          </h2>
          <p className="body-goal__sub">{t('setGoalBody')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {t('setGoalCta')}
        </Button>
        {sheet}
      </Card>
    )
  }

  const editBtn = editable ? <IconButton icon="edit" label={t('editGoal')} variant="ghost" size={36} onClick={() => setOpen(true)} /> : null
  const color = memberColorVar(member.color)
  let right: ReactNode = null
  if (g?.reached)
    right = (
      <Tag tone="good" icon="check">
        {t('goalReached')}
      </Tag>
    )
  else if (g?.eta) right = <span className="body-goal__eta">{t('eta', { date: fmtDate(g.eta, 'dayMonth') })}</span>
  else if (g?.onTrack === false)
    right = (
      <Tag tone="warn" icon="alert">
        {t('offTrack')}
      </Tag>
    )
  else if (g && g.onTrack == null && g.phase !== 'maintain') right = <span className="body-goal__eta">{t('etaLater')}</span>

  return (
    <Card as="section" className="body-goal" aria-labelledby="body-goal-title">
      <div className="body-goal__head">
        <h2 className="body-goal__title" id="body-goal-title">
          {t('goalTitle', { value: wText(goalKg, unit) })}
        </h2>
        <span className="spacer" />
        {right}
        {editBtn}
      </div>
      {g ? (
        <>
          {g.phase === 'maintain' ? (
            <MaintainGauge currentKg={g.currentKg} goalKg={g.goalKg} color={color} label={t('goalProgress', { pct: g.pct })} />
          ) : (
            <div
              className="body-goal__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={g.pct}
              aria-label={t('goalProgress', { pct: g.pct })}
              style={{ ['--p' as string]: `${g.bar * 100}%`, ['--c' as string]: color } as CSSProperties}
            >
              <i className="body-goal__fill" />
              <b className="body-goal__knob" />
              <em className="body-goal__pct num">{g.pct}%</em>
            </div>
          )}
          <div className="body-goal__ends">
            {g.phase === 'maintain' ? (
              <>
                <span>
                  {t('now')} <b className="num">{wNum(g.currentKg, unit)}</b>
                </span>
                <span>
                  {g.reached ? t('within', { value: wAbs(g.goalKg - g.currentKg, unit) }) : t('offBy', { value: wAbs(g.goalKg - g.currentKg, unit) })}
                </span>
              </>
            ) : (
              <>
                <span>
                  {t('start')} <b className="num">{wNum(g.startKg, unit)}</b>
                </span>
                <span>{g.reached ? '' : t('toGo', { value: wAbs(g.toGoKg, unit) })}</span>
              </>
            )}
            <span>
              {t('goal')} <b className="num">{wNum(goalKg, unit)}</b>
            </span>
          </div>
          {g.reached && g.phase !== 'maintain' && <p className="body-goal__note">{t('goalReachedBody', { value: wText(goalKg, unit) })}</p>}
        </>
      ) : (
        <p className="body-goal__sub">{t('goalNoData')}</p>
      )}
      {sheet}
    </Card>
  )
}

/** Hold-steady gauge: goal in the middle, the on-target band around it, the knob at the current trend. */
function MaintainGauge({ currentKg, goalKg, color, label }: { currentKg: number; goalKg: number; color: string; label: string }) {
  const { pos, bandFrom, bandTo } = maintainGauge(currentKg, goalKg)
  const pct = (x: number) => `${x * 100}%`
  return (
    <div
      className="body-goal__bar body-goal__bar--gauge"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos * 100)}
      style={
        { ['--p' as string]: pct(pos), ['--c' as string]: color, ['--b0' as string]: pct(bandFrom), ['--b1' as string]: pct(bandTo) } as CSSProperties
      }
    >
      <i className="body-goal__band" />
      <i className="body-goal__tick" />
      <b className="body-goal__knob" />
    </div>
  )
}
