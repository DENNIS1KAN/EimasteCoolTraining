import type { ReactNode } from 'react'
import type { Member } from '../../data/types'
import { useLang, useT } from '../../i18n'
import { IconButton, PageHeader } from '../../ui'
import { dayPart, greetName } from './logic/greeting'
import { HM } from './messages'

export interface HomeHeaderProps {
  me: Member
  now: number
  eyebrow: ReactNode
  unseen: number
  onBell: () => void
}

/** "THU 24 SEP · WEEK 3 OF 12" over "Good evening, Stelios", with the bell (unseen cheers) and the account avatar. */
export function HomeHeader({ me, now, eyebrow, unseen, onBell }: HomeHeaderProps) {
  const t = useT(HM)
  const lang = useLang()
  const hello = t(dayPart(new Date(now).getHours(), lang))
  return (
    <PageHeader
      variant="greeting"
      className="home-header"
      eyebrow={eyebrow}
      title={t('greeting', { hello, name: greetName(me.name, lang) })}
      account
      actions={<IconButton icon="bell" label={t('notifications')} badge={unseen} onClick={onBell} />}
    />
  )
}
