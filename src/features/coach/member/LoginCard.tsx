import { useState } from 'react'
import { Banner, Button, Card, CardHeader, ConfirmSheet, Skeleton, Tag, toast } from '../../../ui'
import { useT } from '../../../i18n'
import { getBackend, refresh, useStore } from '../../../data/store'
import type { Member } from '../../../data/types'
import { InviteLinkBox } from '../components/InviteLinkBox'
import { useInvites } from '../hooks/useInvites'
import { appLocation, inviteLink } from '../lib/invite'
import { M } from '../messages'

/** Invite status and link, and "Reset login" for a forgotten password (new link, old login detached). */
export function LoginCard({ member }: { member: Member }) {
  const t = useT(M)
  const demo = useStore((s) => s.backend === 'demo')
  const invites = useInvites()
  const [confirming, setConfirming] = useState(false)
  const [justReset, setJustReset] = useState(false)
  const code = invites.codes?.[member.id]
  const link = code ? inviteLink(appLocation(), member.slug, code) : null
  const showLink = !member.joined || justReset

  const reset = async () => {
    try {
      const fresh = await getBackend().resetInvite(member.id, true)
      invites.setCode(member.id, fresh)
      setJustReset(true)
      toast(t('resetDone'), { tone: 'good' })
      void refresh()
    } catch (e) {
      toast(t('resetFailed', { error: e instanceof Error ? e.message : String(e) }), { tone: 'danger' })
      throw e
    }
  }

  return (
    <Card as="section" aria-labelledby="member-login-title" className="stack-lg login-card">
      <CardHeader
        title={<span id="member-login-title">{t('login')}</span>}
        action={
          member.joined && !justReset ? (
            <Tag tone="good" icon="check">
              {t('joined')}
            </Tag>
          ) : (
            <Tag tone="warn" icon="clock">
              {t('invitePending')}
            </Tag>
          )
        }
      />
      <p className="login-card__status">{member.joined && !justReset ? t('statusJoined') : t('statusPending')}</p>

      {showLink ? (
        invites.error ? (
          <Banner
            tone="warn"
            action={
              <Button variant="ghost" size="sm" onClick={invites.reload}>
                {t('retryShort')}
              </Button>
            }
          >
            {t('invitesError')}
          </Banner>
        ) : link ? (
          <InviteLinkBox member={member} link={link} primary={!member.joined || justReset} />
        ) : invites.loading ? (
          <Skeleton height={52} radius={14} />
        ) : (
          <p className="muted">{t('noCode')}</p>
        )
      ) : null}

      {member.joined && !justReset ? (
        <div className="login-reset">
          <p className="login-reset__help">{t('resetHelp')}</p>
          <Button variant="ghost" size="sm" icon="refresh" onClick={() => setConfirming(true)}>
            {t('resetLogin')}
          </Button>
        </div>
      ) : null}
      {demo ? (
        <Banner tone="info" icon="info">
          {t('demoLogin')}
        </Banner>
      ) : null}

      <ConfirmSheet
        open={confirming}
        title={t('resetTitle', { name: member.name })}
        body={t('resetBody')}
        confirmLabel={t('resetConfirm')}
        danger
        onConfirm={reset}
        onClose={() => setConfirming(false)}
      />
    </Card>
  )
}
