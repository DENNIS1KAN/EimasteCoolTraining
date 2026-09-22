import type { Member } from '../../../data/types'
import { useT } from '../../../i18n'
import { toast } from '../../../ui'
import { copyText, shareOrCopy } from '../lib/invite'
import { M } from '../messages'

/** Copy / share an invite link with friendly toasts (EN/EL WhatsApp-ready message). */
export function useInviteActions() {
  const t = useT(M)

  async function copyLink(link: string) {
    const ok = await copyText(link)
    toast(ok ? t('linkCopied') : t('copyFailed'), { tone: ok ? 'good' : 'danger' })
  }

  async function share(member: Pick<Member, 'name' | 'slug'>, link: string) {
    const text = t('shareText', { name: member.name, link, slug: member.slug })
    const r = await shareOrCopy({ title: t('shareTitle'), text })
    if (r === 'copied') toast(t('messageCopied'), { tone: 'good' })
    else if (r === 'failed') toast(t('copyFailed'), { tone: 'danger' })
  }

  return { copyLink, share }
}
