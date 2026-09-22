import { useT } from '../../i18n'
import { dismissHint, usePrefs } from '../../lib/prefs'
import { Card, CardHeader, Icon, IconButton, type IconName } from '../../ui'
import { M } from './messages'

const HINT_ID = 'body-tips'
const TIPS: { icon: IconName; key: 'tip1' | 'tip2' | 'tip3' }[] = [
  { icon: 'sun', key: 'tip1' },
  { icon: 'scale', key: 'tip2' },
  { icon: 'chart', key: 'tip3' },
]

/** How to weigh in, for the first days. Dismissible once the habit is there. */
export function TipsCard({ dismissible = true }: { dismissible?: boolean }) {
  const t = useT(M)
  const prefs = usePrefs()
  if (dismissible && prefs.dismissed[HINT_ID]) return null
  return (
    <Card as="section" className="body-tips" aria-labelledby="body-tips-title">
      <CardHeader
        title={<span id="body-tips-title">{t('tipsTitle')}</span>}
        action={dismissible ? <IconButton icon="x" label={t('hideTips')} variant="ghost" size={36} onClick={() => dismissHint(HINT_ID)} /> : undefined}
      />
      <ul className="body-tips__list">
        {TIPS.map((tip) => (
          <li key={tip.key}>
            <span className="body-tips__icon" aria-hidden="true">
              <Icon name={tip.icon} size={18} />
            </span>
            <span>{t(tip.key)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
