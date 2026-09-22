import type { ReactNode } from 'react'
import { Card, Icon, type IconName } from '../../ui'

interface Props {
  id: string
  icon: IconName
  title: ReactNode
  sub?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** A settings card: icon tile + title (h2) + optional subtitle, then the controls. */
export function Section({ id, icon, title, sub, action, children, className }: Props) {
  const hid = `settings-${id}-title`
  return (
    <Card as="section" id={`settings-${id}`} aria-labelledby={hid} className={['set-card', className].filter(Boolean).join(' ')}>
      <div className="set-card__head">
        <span className="set-card__icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <div className="set-card__titles">
          <h2 id={hid} className="set-card__title" tabIndex={-1}>
            {title}
          </h2>
          {sub ? <p className="set-card__sub">{sub}</p> : null}
        </div>
        {action ? <div className="set-card__action">{action}</div> : null}
      </div>
      <div className="set-card__body">{children}</div>
    </Card>
  )
}
