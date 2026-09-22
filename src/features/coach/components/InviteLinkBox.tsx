import { Button, IconButton } from '../../../ui'
import { useT } from '../../../i18n'
import type { Member } from '../../../data/types'
import { useInviteActions } from '../hooks/useInviteActions'
import { M } from '../messages'

export interface InviteLinkBoxProps {
  member: Pick<Member, 'name' | 'slug'>
  link: string
  /** Make "Share invite" the screen's primary (volt) action. */
  primary?: boolean
}

/** The invite link, selectable, with Copy and Share (WhatsApp-ready message). */
export function InviteLinkBox({ member, link, primary }: InviteLinkBoxProps) {
  const t = useT(M)
  const { copyLink, share } = useInviteActions()
  return (
    <div className="invite-box">
      <p className="micro invite-box__label">{t('inviteLink')}</p>
      <div className="invite-box__row">
        <input
          className="invite-box__link"
          value={link}
          readOnly
          aria-label={t('inviteLink')}
          onFocus={(e) => e.currentTarget.select()}
          spellCheck={false}
        />
        <IconButton icon="copy" label={t('copyLink')} variant="soft" onClick={() => void copyLink(link)} />
      </div>
      <Button variant={primary ? 'primary' : 'secondary'} icon="share" block onClick={() => void share(member, link)}>
        {t('shareInvite')}
      </Button>
    </div>
  )
}
