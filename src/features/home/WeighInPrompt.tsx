import { useState } from 'react'
import { useStore } from '../../data/store'
import type { Member, WeightEntry } from '../../data/types'
import { useT } from '../../i18n'
import type { ISODate } from '../../lib/dates'
import { fmtDayLabel, fmtWeight } from '../../lib/format'
import { Button, Card, Icon } from '../../ui'
import { LogWeightSheet } from '../body/LogWeightSheet'
import { shouldPromptWeighIn } from './logic/tiles'
import { HM } from './messages'

/** A slim morning reminder to step on the scale (one tap to the weigh-in sheet), for athletes who weigh in already. */
export function WeighInPrompt({ me, today, now }: { me: Member; today: ISODate; now: number }) {
  const t = useT(HM)
  const [open, setOpen] = useState(false)
  // The sheet derives the weight model: mount it on first use only (and keep it for its closing animation).
  const [used, setUsed] = useState(false)
  const mine = useStore((s) => {
    const out: WeightEntry[] = []
    for (const w of Object.values(s.weights)) if (w.memberId === me.id) out.push(w)
    return out
  })
  const show = shouldPromptWeighIn(
    mine.map((w) => w.date),
    today,
    new Date(now).getHours(),
  )
  // Keep the sheet around while it is open, even once the new weigh-in hides the prompt.
  if (!show && !used) return null
  const last = mine.reduce<WeightEntry | null>((a, w) => (!a || w.date > a.date ? w : a), null)
  return (
    <>
      {show ? (
        <Card as="section" padding="sm" className="home-weigh" aria-labelledby="home-weigh-t">
          <span className="home-weigh__icon" aria-hidden="true">
            <Icon name="scale" size={20} />
          </span>
          <div className="home-weigh__text">
            <h2 id="home-weigh-t" className="home-weigh__title">
              {t('weighTitle')}
            </h2>
            {last ? (
              <p className="home-weigh__sub">{t('weighLast', { value: fmtWeight(last.kg, me.settings.unit), when: fmtDayLabel(last.date) })}</p>
            ) : null}
          </div>
          <Button
            size="sm"
            icon="plus"
            onClick={() => {
              setUsed(true)
              setOpen(true)
            }}
          >
            {t('weighLog')}
          </Button>
        </Card>
      ) : null}
      {used ? <LogWeightSheet open={open} onClose={() => setOpen(false)} /> : null}
    </>
  )
}
