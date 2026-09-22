import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useT } from '../../i18n'
import { Card, Icon, IconButton, cx } from '../../ui'
import { HM } from './messages'

export interface ChecklistItem {
  id: string
  title: string
  sub: string
  done: boolean
  waiting: boolean
  /** The step to do next (gets the highlight). */
  current: boolean
  /** A route to open, or a handler (e.g. open a sheet). Omitted: the row is not actionable. */
  to?: string
  onClick?: () => void
}

export interface ChecklistProps {
  eyebrow: string
  title: string
  items: ChecklistItem[]
  dismissLabel: string
  onDismiss: () => void
  /** Rendered under the title when every item is done (replaces the list). */
  doneState?: ReactNode
}

/** A getting-started card: eyebrow, title, segmented progress and numbered steps with one highlighted "next". */
export function Checklist({ eyebrow, title, items, dismissLabel, onDismiss, doneState }: ChecklistProps) {
  const t = useT(HM)
  const id = useId()
  const done = items.filter((i) => i.done).length
  const complete = done === items.length
  return (
    <Card as="section" className={cx('home-check', complete && 'is-complete')} aria-labelledby={`${id}-t`}>
      <div className="home-check__head">
        <div className="home-check__titles">
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`${id}-t`} className="home-check__title">
            {title}
          </h2>
        </div>
        <IconButton icon="x" label={dismissLabel} variant="ghost" size={36} onClick={onDismiss} className="home-check__x" />
      </div>
      <div className="home-check__progress">
        <ol className="home-check__segs" aria-hidden="true">
          {items.map((i) => (
            <li key={i.id} className={cx(i.done && 'is-done')} />
          ))}
        </ol>
        <p className="home-check__count">{t('obProgress', { done, total: items.length })}</p>
      </div>
      {complete && doneState ? (
        doneState
      ) : (
        <ol className="home-check__list">
          {items.map((it, n) => (
            <li key={it.id}>
              <Row item={it} n={n + 1} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function Row({ item, n }: { item: ChecklistItem; n: number }) {
  const t = useT(HM)
  const actionable = !item.done && !item.waiting && (!!item.to || !!item.onClick)
  const cls = cx('home-step', item.done && 'is-done', item.waiting && 'is-waiting', item.current && 'is-current', actionable && 'is-action')
  const body = (
    <>
      <span className="home-step__mark" aria-hidden="true">
        {item.done ? <Icon name="check" size={15} strokeWidth={2.8} /> : item.waiting ? <Icon name="clock" size={14} strokeWidth={2.2} /> : n}
      </span>
      <span className="home-step__text">
        <span className="home-step__title">{item.title}</span>
        <span className="home-step__sub">{item.sub}</span>
      </span>
      {item.done ? (
        <span className="visually-hidden">{t('stepDone')}</span>
      ) : item.waiting ? (
        <span className="visually-hidden">{t('stepWaiting')}</span>
      ) : actionable ? (
        <Icon name="chevron-right" size={18} className="home-step__chev" />
      ) : null}
    </>
  )
  if (!actionable) return <div className={cls}>{body}</div>
  if (item.to) {
    return (
      <Link to={item.to} className={cls} onClick={item.onClick}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} onClick={item.onClick}>
      {body}
    </button>
  )
}
