import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useMe } from '../data/store'
import { useT } from '../i18n'
import { openAccountSheet } from './accountSheet'
import { Avatar } from './Avatar'
import { IconButton } from './Button'
import { cx } from './cx'
import { Icon } from './Icon'
import { UIM } from './messages'
import { Link } from 'react-router'

export interface PageHeaderProps {
  /** Small uppercase line above the title: "THU 24 SEP · WEEK 3 OF 12". */
  eyebrow?: ReactNode
  /** Big condensed uppercase screen title ("Squad"), or a greeting with variant="greeting". */
  title: ReactNode
  subtitle?: ReactNode
  /** true = history back; a path = link to it. Renders a chevron button left of the title. */
  back?: boolean | string
  /** Right-hand actions (IconButtons, a Segmented range…). */
  actions?: ReactNode
  /** Render the viewer's avatar button (opens the account sheet). */
  account?: boolean
  /** title (32 px, uppercase, default) or greeting (33 px, sentence case, e.g. "Καλησπέρα, Στέλιο"). */
  variant?: 'title' | 'greeting'
  className?: string
}

/** Screen header: eyebrow + big display title on the left, actions and the account avatar on the right. */
export function PageHeader({ eyebrow, title, subtitle, back, actions, account, variant = 'title', className }: PageHeaderProps) {
  const t = useT(UIM)
  const navigate = useNavigate()
  const me = useMe()

  const backEl =
    back === true ? (
      <IconButton icon="chevron-left" label={t('back')} variant="soft" size={40} className="ui-page-header__back" onClick={() => navigate(-1)} />
    ) : typeof back === 'string' ? (
      <Link to={back} className="ui-iconbtn ui-iconbtn--soft ui-page-header__back" aria-label={t('back')} style={{ ['--ib-size' as string]: '40px' }}>
        <Icon name="chevron-left" size={20} />
      </Link>
    ) : null

  return (
    <header className={cx('ui-page-header', `ui-page-header--${variant}`, className)}>
      {backEl}
      <div className="ui-page-header__text">
        {eyebrow ? <p className="eyebrow ui-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="ui-page-header__title">{title}</h1>
        {subtitle ? <p className="ui-page-header__sub">{subtitle}</p> : null}
      </div>
      {actions || account ? (
        <div className="ui-page-header__actions">
          {actions}
          {account ? (
            <button
              type="button"
              className="ui-page-header__account"
              aria-label={me ? t('accountOf', { name: me.name }) : t('account')}
              aria-haspopup="dialog"
              onClick={() => openAccountSheet()}
            >
              {me ? <Avatar member={me} size={40} decorative /> : <Icon name="user" size={20} />}
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
